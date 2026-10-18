-- =====================================================================
-- GharFresh | Migration 003 | Admin / support functions
-- Run AFTER 001 and 002.
-- =====================================================================

create or replace function public.require_staff()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
end $$;

-- Manual wallet credit / adjustment (audit-logged)
create or replace function public.admin_wallet_adjust(
  p_user uuid, p_type text, p_amount numeric, p_desc text
) returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  perform public.require_staff();
  if p_type not in ('credit','cashback','adjustment','debit') then raise exception 'Invalid type'; end if;
  v := public.wallet_apply(p_user, p_type, p_amount, null, coalesce(p_desc, 'Admin adjustment'));
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'wallet_adjust', 'wallets', p_user::text,
          jsonb_build_object('type', p_type, 'amount', p_amount, 'desc', p_desc));
  return v;
end $$;

-- Resolve complaint, optionally refunding to wallet
create or replace function public.admin_resolve_complaint(
  p_id uuid, p_status text, p_refund numeric default 0
) returns void language plpgsql security definer set search_path = public as $$
declare c public.complaints%rowtype;
begin
  perform public.require_staff();
  if p_status not in ('in_progress','resolved','rejected') then raise exception 'Invalid status'; end if;
  select * into c from public.complaints where id = p_id for update;
  if not found then raise exception 'Complaint not found'; end if;
  if c.status in ('resolved','rejected') then raise exception 'Already closed'; end if;
  if p_status = 'resolved' and coalesce(p_refund,0) > 0 then
    perform public.wallet_apply(c.user_id, 'refund', p_refund, c.order_id, 'Refund for complaint');
  end if;
  update public.complaints
     set status = p_status,
         refund_amount = case when p_status = 'resolved' then nullif(p_refund,0) else refund_amount end,
         resolved_at = case when p_status in ('resolved','rejected') then now() else null end
   where id = p_id;
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'complaint_' || p_status, 'complaints', p_id::text,
          jsonb_build_object('refund', p_refund));
end $$;

-- Admin order status (delivered is NOT allowed here: needs rider proof)
create or replace function public.admin_set_order_status(p_order uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  perform public.require_staff();
  if p_status not in ('packed','out_for_delivery','cancelled') then
    raise exception 'Delivered/failed can only be set by rider with proof';
  end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status in ('delivered','cancelled') then raise exception 'Order is closed'; end if;
  if p_status = 'cancelled' then
    update public.products p set stock = p.stock + i.quantity
      from public.order_items i where i.order_id = o.id and i.product_id = p.id;
    if o.payment_status = 'paid' and o.total > 0 then
      perform public.wallet_apply(o.user_id, 'refund', o.total, o.id, 'Order cancelled by admin');
      update public.orders set payment_status = 'refunded' where id = o.id;
    end if;
  end if;
  update public.orders set status = p_status where id = o.id;
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'order_status', 'orders', p_order::text, jsonb_build_object('status', p_status));
end $$;

-- Build a route for one society + date and assign a rider
create or replace function public.admin_assign_route(p_date date, p_society uuid, p_rider uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_route uuid; v_seq int := 0; o record;
begin
  perform public.require_staff();
  if not exists (select 1 from public.profiles where id = p_rider and role = 'rider') then
    raise exception 'Selected user is not a rider';
  end if;
  insert into public.routes (name, society_id, rider_id, delivery_date)
  select 'Route - ' || s.name, s.id, p_rider, p_date from public.societies s where s.id = p_society
  returning id into v_route;
  if v_route is null then raise exception 'Society not found'; end if;

  for o in
    select ord.id from public.orders ord
    join public.addresses a on a.id = ord.address_id
    where ord.delivery_date = p_date and a.society_id = p_society
      and ord.status in ('pending','packed') and ord.route_id is null
    order by a.line1, a.house_no
  loop
    v_seq := v_seq + 1;
    insert into public.route_stops (route_id, order_id, sequence) values (v_route, o.id, v_seq);
    update public.orders set rider_id = p_rider, route_id = v_route where id = o.id;
  end loop;

  if v_seq = 0 then raise exception 'No unassigned orders for this area and date'; end if;
  insert into public.audit_log (actor_id, action, table_name, record_id, details)
  values (auth.uid(), 'route_created', 'routes', v_route::text,
          jsonb_build_object('stops', v_seq, 'rider', p_rider));
  return v_route;
end $$;

-- Give a user the rider / support / customer role (admin only)
create or replace function public.admin_set_role(p_contact text, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if p_role not in ('customer','rider','support','packer','admin') then raise exception 'Invalid role'; end if;
  update public.profiles set role = p_role
   where lower(email) = lower(p_contact) or phone = p_contact;
  if not found then raise exception 'No user found with that email/phone (they must sign up first)'; end if;
  insert into public.audit_log (actor_id, action, table_name, details)
  values (auth.uid(), 'set_role', 'profiles', jsonb_build_object('contact', p_contact, 'role', p_role));
end $$;

-- Dashboard numbers
create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff();
  return jsonb_build_object(
    'active_subscriptions', (select count(*) from public.subscriptions where status = 'active'),
    'next_day_orders', (select count(*) from public.orders
                         where delivery_date = public.next_eligible_date() and status <> 'cancelled'),
    'delivered_7d', (select count(*) from public.orders where status = 'delivered' and delivery_date >= current_date - 7),
    'failed_7d', (select count(*) from public.orders where status = 'failed' and delivery_date >= current_date - 7),
    'revenue_7d', (select coalesce(sum(total),0) from public.orders where status = 'delivered' and delivery_date >= current_date - 7),
    'open_complaints', (select count(*) from public.complaints where status in ('open','in_progress'))
  );
end $$;

revoke execute on function public.require_staff() from public, anon, authenticated;
grant execute on function
  public.admin_wallet_adjust(uuid,text,numeric,text), public.admin_resolve_complaint(uuid,text,numeric),
  public.admin_set_order_status(uuid,text), public.admin_assign_route(date,uuid,uuid),
  public.admin_set_role(text,text), public.admin_stats()
to authenticated;
