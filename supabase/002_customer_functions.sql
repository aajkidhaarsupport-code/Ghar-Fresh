-- =====================================================================
-- GharFresh | Migration 002 | Customer functions (cut-off enforced on server)
-- Run AFTER 001 in the same new Supabase project.
-- =====================================================================

-- Next date a change/order can still apply to:
-- before cut-off -> tomorrow, after cut-off -> day after tomorrow (IST)
create or replace function public.next_eligible_date()
returns date language plpgsql stable as $$
declare
  c time; tz text; n timestamp;
begin
  select value into tz from public.app_settings where key = 'timezone';
  select value::time into c from public.app_settings where key = 'order_cutoff_time';
  n := now() at time zone coalesce(tz, 'Asia/Kolkata');
  if n::time < coalesce(c, '22:00'::time) then return n::date + 1; end if;
  return n::date + 2;
end $$;

create or replace function public.assert_not_blocked()
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and is_blocked) then
    raise exception 'Account blocked. Please contact support.';
  end if;
end $$;

-- Create subscription
create or replace function public.create_subscription(
  p_address uuid, p_product uuid, p_qty int, p_freq text,
  p_custom_days text[], p_start date
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_start date;
begin
  perform public.assert_not_blocked();
  if auth.uid() is null then raise exception 'Login required'; end if;
  if not exists (select 1 from public.addresses where id = p_address and user_id = auth.uid() and deleted_at is null) then
    raise exception 'Invalid address';
  end if;
  if not exists (select 1 from public.products where id = p_product and is_active and is_subscription_allowed) then
    raise exception 'Product not available for subscription';
  end if;
  if p_qty is null or p_qty < 1 then raise exception 'Invalid quantity'; end if;
  if p_freq = 'custom' and coalesce(array_length(p_custom_days,1),0) = 0 then
    raise exception 'Select at least one day';
  end if;
  v_start := greatest(p_start, public.next_eligible_date());
  insert into public.subscriptions
    (user_id, address_id, product_id, quantity, frequency, custom_days, start_date, next_delivery_date)
  values (auth.uid(), p_address, p_product, p_qty, p_freq, p_custom_days, v_start, v_start)
  returning id into v_id;
  return v_id;
end $$;

-- Pause / resume / cancel own subscription
create or replace function public.set_subscription_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('active','paused','cancelled') then raise exception 'Invalid status'; end if;
  update public.subscriptions set status = p_status
   where id = p_id and user_id = auth.uid() and status <> 'cancelled';
  if not found then raise exception 'Subscription not found'; end if;
end $$;

-- Change quantity (applies from next eligible delivery)
create or replace function public.update_subscription_qty(p_id uuid, p_qty int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_qty < 1 then raise exception 'Invalid quantity'; end if;
  update public.subscriptions set quantity = p_qty
   where id = p_id and user_id = auth.uid() and status in ('active','paused');
  if not found then raise exception 'Subscription not found'; end if;
end $$;

-- Skip a specific date
create or replace function public.add_pause_date(p_id uuid, p_date date)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_date < public.next_eligible_date() then
    raise exception 'Cut-off passed for that date';
  end if;
  if not exists (select 1 from public.subscriptions where id = p_id and user_id = auth.uid()) then
    raise exception 'Subscription not found';
  end if;
  insert into public.subscription_pause_dates (subscription_id, pause_date)
  values (p_id, p_date) on conflict do nothing;
end $$;

-- One-time basket order, paid from wallet. Prices are read from the DB, never from the client.
create or replace function public.create_basket_order(p_address uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_date date := public.next_eligible_date();
  v_order uuid; v_sub numeric := 0; v_fee numeric := 0;
  it jsonb; p public.products%rowtype; q int;
begin
  perform public.assert_not_blocked();
  if auth.uid() is null then raise exception 'Login required'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then raise exception 'Basket is empty'; end if;

  select coalesce(s.delivery_fee,0) into v_fee
    from public.addresses a left join public.societies s on s.id = a.society_id
   where a.id = p_address and a.user_id = auth.uid() and a.deleted_at is null;
  if not found then raise exception 'Invalid address'; end if;

  insert into public.orders (user_id, address_id, delivery_date, status, payment_status, payment_method)
  values (auth.uid(), p_address, v_date, 'pending', 'unpaid', 'wallet')
  returning id into v_order;

  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'quantity')::int;
    if q is null or q < 1 then raise exception 'Invalid quantity'; end if;
    select * into p from public.products where id = (it->>'product_id')::uuid and is_active for update;
    if not found then raise exception 'Product unavailable'; end if;
    if p.stock < q then raise exception '% is out of stock', p.name; end if;
    update public.products set stock = stock - q where id = p.id;
    insert into public.order_items (order_id, product_id, quantity, unit_price, total_price)
    values (v_order, p.id, q, p.selling_price, p.selling_price * q);
    v_sub := v_sub + p.selling_price * q;
  end loop;

  update public.orders set subtotal = v_sub, delivery_fee = v_fee, total = v_sub + v_fee,
         payment_status = 'paid' where id = v_order;
  perform public.wallet_apply(auth.uid(), 'debit', v_sub + v_fee, v_order, 'Order payment');
  return v_order;
end $$;

-- Cancel own pending order before cut-off; refund to wallet
create or replace function public.cancel_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'pending' then raise exception 'Order can no longer be cancelled'; end if;
  if o.delivery_date < public.next_eligible_date() then raise exception 'Cut-off passed'; end if;
  update public.order_items i set quantity = i.quantity where i.order_id = o.id;
  update public.products p set stock = p.stock + i.quantity
    from public.order_items i where i.order_id = o.id and i.product_id = p.id;
  update public.orders set status = 'cancelled',
         payment_status = case when o.payment_status = 'paid' then 'refunded' else o.payment_status end
   where id = o.id;
  if o.payment_status = 'paid' and o.total > 0 then
    perform public.wallet_apply(o.user_id, 'refund', o.total, o.id, 'Order cancelled');
  end if;
end $$;

grant execute on function
  public.next_eligible_date(), public.create_subscription(uuid,uuid,int,text,text[],date),
  public.set_subscription_status(uuid,text), public.update_subscription_qty(uuid,int),
  public.add_pause_date(uuid,date), public.create_basket_order(uuid,jsonb),
  public.cancel_order(uuid)
to authenticated;
revoke execute on function public.assert_not_blocked() from public, anon, authenticated;
