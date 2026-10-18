-- =====================================================================
-- GharFresh | Migration 005 | Nightly order generation + notification outbox
-- Run AFTER 001-004.
-- =====================================================================

-- ---------- notification outbox (a worker sends these via Brevo) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null default 'email',
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index on public.notifications (status, created_at);
alter table public.notifications enable row level security;
create policy notifications_own_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_staff_read on public.notifications for select using (public.is_staff());

create or replace function public.enqueue_notification(p_user uuid, p_template text, p_payload jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, template, payload) values (p_user, p_template, p_payload);
$$;
revoke all on function public.enqueue_notification(uuid,text,jsonb) from public, anon, authenticated;

-- ---------- notification triggers ----------
create or replace function public.notify_order_events()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text; t timestamptz;
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'out_for_delivery' then
    perform public.enqueue_notification(new.user_id, 'out_for_delivery',
      jsonb_build_object('order_id', new.id, 'date', new.delivery_date));
  elsif new.status = 'delivered' then
    select delivered_at into t from public.delivery_proofs
     where order_id = new.id and status = 'delivered' order by created_at desc limit 1;
    perform public.enqueue_notification(new.user_id, 'delivered',
      jsonb_build_object('order_id', new.id, 'at', coalesce(t, now())));
  elsif new.status = 'failed' then
    select failure_reason into r from public.delivery_proofs
     where order_id = new.id and status = 'failed' order by created_at desc limit 1;
    perform public.enqueue_notification(new.user_id, 'delivery_failed',
      jsonb_build_object('order_id', new.id, 'date', new.delivery_date, 'reason', r,
                         'total', new.total, 'paid', new.payment_status = 'paid'));
  end if;
  return new;
end $$;
create trigger trg_orders_notify after update of status on public.orders
for each row execute function public.notify_order_events();

create or replace function public.notify_refund()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'refund' then
    perform public.enqueue_notification(new.user_id, 'refund_processed',
      jsonb_build_object('amount', new.amount, 'tx_id', new.id, 'balance', new.balance_after,
                         'description', new.description));
  end if;
  return new;
end $$;
create trigger trg_wallet_tx_notify after insert on public.wallet_transactions
for each row execute function public.notify_refund();

create or replace function public.notify_wallet_low()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.balance < new.auto_recharge_threshold and old.balance >= old.auto_recharge_threshold then
    perform public.enqueue_notification(new.user_id, 'wallet_low', jsonb_build_object('balance', new.balance));
  end if;
  return new;
end $$;
create trigger trg_wallet_low after update of balance on public.wallets
for each row execute function public.notify_wallet_low();

-- ---------- next date a subscription runs after p_after ----------
create or replace function public.next_occurrence(p_freq text, p_days text[], p_after date)
returns date language plpgsql immutable as $$
declare d date := p_after; i int;
begin
  if p_freq = 'daily' then return p_after + 1;
  elsif p_freq = 'alternate_days' then return p_after + 2;
  elsif p_freq = 'weekdays' then
    loop d := d + 1; exit when extract(isodow from d) between 1 and 5; end loop;
    return d;
  elsif p_freq = 'custom' then
    for i in 1..14 loop
      d := d + 1;
      if lower(to_char(d, 'dy')) = any (p_days) then return d; end if;
    end loop;
    return null;
  end if;
  return null;   -- one_time
end $$;

-- ---------- the nightly job (10:15 PM IST) ----------
create or replace function public.generate_next_day_orders()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_tz text := coalesce((select value from public.app_settings where key = 'timezone'), 'Asia/Kolkata');
  v_target date := (now() at time zone v_tz)::date + 1;
  s record; g record; p public.products%rowtype;
  d date; v_order uuid; v_sub numeric; v_fee numeric; v_items int; v_total numeric; v_bal numeric;
  v_ok boolean; v_next date;
  n_created int := 0; n_hold int := 0; n_skipped int := 0; n_err int := 0;
begin
  -- 1) catch up subscriptions whose date is in the past (e.g. resumed after a pause)
  for s in select id, frequency, custom_days, next_delivery_date from public.subscriptions
            where status = 'active' and next_delivery_date is not null and next_delivery_date < v_target
  loop
    d := s.next_delivery_date;
    while d is not null and d < v_target loop
      d := public.next_occurrence(s.frequency, s.custom_days, d);
    end loop;
    if d is null then
      update public.subscriptions set status = 'completed', next_delivery_date = null where id = s.id;
    else
      update public.subscriptions set next_delivery_date = d where id = s.id;
    end if;
  end loop;

  -- 2) one order per customer + address for the target date
  for g in select user_id, address_id from public.subscriptions
            where status = 'active' and next_delivery_date = v_target
            group by user_id, address_id
  loop
    begin
      select (a.deleted_at is null and coalesce(soc.is_serviceable, true)), coalesce(soc.delivery_fee, 0)
        into v_ok, v_fee
        from public.addresses a left join public.societies soc on soc.id = a.society_id
       where a.id = g.address_id;
      v_ok := coalesce(v_ok, false)
              and not exists (select 1 from public.profiles where id = g.user_id and is_blocked);

      insert into public.orders (user_id, address_id, delivery_date, status, payment_status, payment_method)
      values (g.user_id, g.address_id, v_target, 'pending', 'unpaid', 'wallet')
      returning id into v_order;
      v_sub := 0; v_items := 0;

      for s in select * from public.subscriptions
                where user_id = g.user_id and address_id = g.address_id
                  and status = 'active' and next_delivery_date = v_target
      loop
        -- always move the subscription forward
        v_next := public.next_occurrence(s.frequency, s.custom_days, v_target);
        if v_next is null or (s.end_date is not null and v_next > s.end_date) then
          update public.subscriptions set status = 'completed', next_delivery_date = null where id = s.id;
        else
          update public.subscriptions set next_delivery_date = v_next where id = s.id;
        end if;

        if not v_ok
           or (s.end_date is not null and s.end_date < v_target)
           or exists (select 1 from public.subscription_pause_dates
                       where subscription_id = s.id and pause_date = v_target) then
          n_skipped := n_skipped + 1; continue;
        end if;

        select * into p from public.products where id = s.product_id and is_active for update;
        if not found or p.stock < s.quantity then
          n_skipped := n_skipped + 1;
          insert into public.audit_log (action, table_name, record_id, details)
          values ('sub_skipped', 'subscriptions', s.id::text,
                  jsonb_build_object('date', v_target, 'reason', 'product unavailable or out of stock'));
          continue;
        end if;

        update public.products set stock = stock - s.quantity where id = p.id;
        insert into public.order_items (order_id, product_id, quantity, unit_price, total_price)
        values (v_order, p.id, s.quantity, p.selling_price, p.selling_price * s.quantity);
        v_sub := v_sub + p.selling_price * s.quantity;
        v_items := v_items + 1;
      end loop;

      if v_items = 0 then
        delete from public.orders where id = v_order;
      else
        v_total := v_sub + v_fee;
        select balance into v_bal from public.wallets where user_id = g.user_id for update;
        if v_total = 0 or coalesce(v_bal, 0) >= v_total then
          update public.orders set subtotal = v_sub, delivery_fee = v_fee, total = v_total,
                 payment_status = 'paid' where id = v_order;
          if v_total > 0 then
            perform public.wallet_apply(g.user_id, 'debit', v_total, v_order, 'Delivery on ' || v_target);
          end if;
          perform public.enqueue_notification(g.user_id, 'order_confirmed',
            jsonb_build_object('order_id', v_order, 'date', v_target, 'total', v_total));
          n_created := n_created + 1;
        else
          -- never negative, never fake-paid: hold the delivery and tell the customer
          update public.orders set subtotal = v_sub, delivery_fee = v_fee, total = v_total,
                 status = 'on_hold', payment_status = 'unpaid' where id = v_order;
          perform public.enqueue_notification(g.user_id, 'order_on_hold',
            jsonb_build_object('order_id', v_order, 'date', v_target, 'total', v_total,
                               'balance', coalesce(v_bal, 0)));
          n_hold := n_hold + 1;
        end if;
      end if;
    exception when others then
      n_err := n_err + 1;
      insert into public.audit_log (action, table_name, record_id, details)
      values ('generation_error', 'subscriptions', g.user_id::text,
              jsonb_build_object('date', v_target, 'error', sqlerrm));
    end;
  end loop;

  insert into public.audit_log (action, details)
  values ('nightly_generation', jsonb_build_object('date', v_target, 'created', n_created,
          'on_hold', n_hold, 'skipped_items', n_skipped, 'errors', n_err));
  return jsonb_build_object('delivery_date', v_target, 'created', n_created,
         'on_hold', n_hold, 'skipped_items', n_skipped, 'errors', n_err);
end $$;
revoke execute on function public.generate_next_day_orders() from public, anon, authenticated;

-- manual run from the admin dashboard (staff only)
create or replace function public.admin_generate_orders_now()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  return public.generate_next_day_orders();
end $$;

-- release an on-hold order after the customer topped up the wallet
create or replace function public.admin_release_held_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  perform public.require_staff();
  select * into o from public.orders where id = p_order and status = 'on_hold' for update;
  if not found then raise exception 'Order is not on hold'; end if;
  perform public.wallet_apply(o.user_id, 'debit', o.total, o.id, 'Delivery on ' || o.delivery_date);
  update public.orders set status = 'pending', payment_status = 'paid' where id = o.id;
  insert into public.audit_log (actor_id, action, table_name, record_id)
  values (auth.uid(), 'release_held_order', 'orders', p_order::text);
end $$;

grant execute on function public.admin_generate_orders_now(), public.admin_release_held_order(uuid) to authenticated;
