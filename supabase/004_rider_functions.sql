-- =====================================================================
-- GharFresh | Migration 004 | Rider flow, delivery proof storage, failed-delivery refund
-- Run AFTER 001, 002, 003.
-- =====================================================================

-- ---------- private storage bucket for delivery photos ----------
insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;

create policy "rider uploads own proofs" on storage.objects for insert to authenticated
with check (bucket_id = 'delivery-proofs' and exists (
  select 1 from public.orders o
  where o.id::text = (storage.foldername(name))[1] and o.rider_id = auth.uid()));

create policy "rider updates own proofs" on storage.objects for update to authenticated
using (bucket_id = 'delivery-proofs' and exists (
  select 1 from public.orders o
  where o.id::text = (storage.foldername(name))[1] and o.rider_id = auth.uid()));

create policy "proofs readable by staff, rider, customer" on storage.objects for select to authenticated
using (bucket_id = 'delivery-proofs' and (
  public.is_staff() or exists (
    select 1 from public.orders o
    where o.id::text = (storage.foldername(name))[1]
      and (o.user_id = auth.uid() or o.rider_id = auth.uid()))));

-- ---------- rider: today's route (masked phone, only own stops) ----------
create or replace function public.rider_my_route(p_date date default null)
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare d date := coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date); r jsonb;
begin
  if public.current_role_name() <> 'rider' then raise exception 'Riders only'; end if;
  select coalesce(jsonb_agg(x order by seq), '[]'::jsonb) into r from (
    select rs.sequence as seq, jsonb_build_object(
      'order_id', o.id, 'sequence', rs.sequence, 'status', o.status,
      'customer', split_part(coalesce(p.full_name, 'Customer'), ' ', 1),
      'phone_masked', case when p.phone is null then null
                      else repeat('*', greatest(length(p.phone) - 4, 0)) || right(p.phone, 4) end,
      'house_no', a.house_no, 'line1', a.line1, 'line2', a.line2, 'landmark', a.landmark,
      'instructions', a.delivery_instructions, 'lat', a.lat, 'lng', a.lng, 'society', s.name,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('name', pr.name, 'pack', pr.pack_size, 'qty', i.quantity)), '[]'::jsonb)
                from public.order_items i join public.products pr on pr.id = i.product_id
                where i.order_id = o.id)
    ) as x
    from public.route_stops rs
    join public.orders o on o.id = rs.order_id
    join public.profiles p on p.id = o.user_id
    join public.addresses a on a.id = o.address_id
    left join public.societies s on s.id = a.society_id
    where o.rider_id = auth.uid() and o.delivery_date = d and o.status <> 'cancelled'
  ) t;
  return r;
end $$;

-- ---------- rider: start route ----------
create or replace function public.rider_start_route(p_date date default null)
returns int language plpgsql security definer set search_path = public as $$
declare d date := coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date); n int;
begin
  if public.current_role_name() <> 'rider' then raise exception 'Riders only'; end if;
  update public.orders set status = 'out_for_delivery'
   where rider_id = auth.uid() and delivery_date = d and status in ('pending','packed');
  get diagnostics n = row_count;
  update public.routes set status = 'in_progress'
   where rider_id = auth.uid() and delivery_date = d and status = 'planned';
  return n;
end $$;

-- ---------- rider: delivered (needs photo + GPS + timestamp; safe to retry) ----------
create or replace function public.rider_mark_delivered(
  p_order uuid, p_photo text, p_lat numeric, p_lng numeric, p_at timestamptz default null
) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if public.current_role_name() <> 'rider' then raise exception 'Riders only'; end if;
  select * into o from public.orders where id = p_order and rider_id = auth.uid() for update;
  if not found then raise exception 'Order not assigned to you'; end if;
  if o.status = 'delivered' then return; end if;            -- offline retry: already done
  if o.status in ('cancelled','failed') then raise exception 'Order is already %', o.status; end if;
  if p_photo is null or p_lat is null or p_lng is null then
    raise exception 'Photo and GPS location are required';
  end if;
  if split_part(p_photo, '/', 1) <> p_order::text then raise exception 'Invalid photo path'; end if;

  insert into public.delivery_proofs (order_id, rider_id, photo_url, latitude, longitude, delivered_at, status)
  values (p_order, auth.uid(), p_photo, p_lat, p_lng, coalesce(p_at, now()), 'delivered');
  update public.orders set status = 'delivered' where id = p_order;
  update public.route_stops set status = 'delivered' where order_id = p_order;
  update public.routes set status = 'completed'
   where id = o.route_id and not exists (
     select 1 from public.route_stops where route_id = o.route_id and status = 'pending');
end $$;

-- ---------- rider: failed (auto-creates complaint; customer can claim refund) ----------
create or replace function public.rider_mark_failed(
  p_order uuid, p_reason text, p_notes text default null,
  p_lat numeric default null, p_lng numeric default null
) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  if public.current_role_name() <> 'rider' then raise exception 'Riders only'; end if;
  select * into o from public.orders where id = p_order and rider_id = auth.uid() for update;
  if not found then raise exception 'Order not assigned to you'; end if;
  if o.status = 'failed' then return; end if;               -- offline retry
  if o.status in ('delivered','cancelled') then raise exception 'Order is already %', o.status; end if;
  if p_reason not in ('customer_absent','gate_closed','wrong_address','refused','vehicle_issue','other') then
    raise exception 'Invalid reason';
  end if;

  insert into public.delivery_proofs (order_id, rider_id, latitude, longitude, delivered_at, status, failure_reason, notes)
  values (p_order, auth.uid(), p_lat, p_lng, now(), 'failed', p_reason, p_notes);
  update public.orders set status = 'failed' where id = p_order;
  update public.route_stops set status = 'failed' where order_id = p_order;
  insert into public.complaints (user_id, order_id, type, description, status)
  values (o.user_id, p_order, 'not_received', 'Auto: delivery failed (' || p_reason || ')', 'open');
  update public.routes set status = 'completed'
   where id = o.route_id and not exists (
     select 1 from public.route_stops where route_id = o.route_id and status = 'pending');
end $$;

-- ---------- customer: instant refund to wallet for a failed delivery ----------
create or replace function public.customer_claim_refund(p_order uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status <> 'failed' then raise exception 'Instant refund is only for failed deliveries'; end if;
  if o.payment_status <> 'paid' or o.total <= 0 then raise exception 'Nothing to refund'; end if;

  perform public.wallet_apply(o.user_id, 'refund', o.total, o.id, 'Refund for failed delivery');
  update public.orders set payment_status = 'refunded' where id = o.id;
  update public.complaints
     set status = 'resolved', refund_amount = o.total, resolved_at = now()
   where order_id = o.id and type = 'not_received' and status in ('open','in_progress');
  return o.total;
end $$;

grant execute on function
  public.rider_my_route(date), public.rider_start_route(date),
  public.rider_mark_delivered(uuid,text,numeric,numeric,timestamptz),
  public.rider_mark_failed(uuid,text,text,numeric,numeric),
  public.customer_claim_refund(uuid)
to authenticated;
