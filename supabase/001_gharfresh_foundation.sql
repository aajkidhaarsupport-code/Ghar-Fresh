-- =====================================================================
-- GharFresh | Migration 001 | Foundation
-- Run in a NEW Supabase project (SQL Editor). Do NOT run on the old site.
-- Contents: tables, triggers, wallet function, price audit, RLS.
-- =====================================================================

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- core tables ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text unique,
  email text,
  role text not null default 'customer'
    check (role in ('customer','rider','admin','support','packer')),
  is_blocked boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.societies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  pincode text,
  is_serviceable boolean not null default true,
  delivery_fee numeric not null default 0 check (delivery_fee >= 0),
  cutoff_time time not null default '22:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  line1 text,
  line2 text,
  society_id uuid references public.societies(id),
  house_no text,
  landmark text,
  lat numeric,
  lng numeric,
  delivery_instructions text,
  is_default boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id),
  name text not null,
  description text,
  image_url text,
  pack_size text,
  unit text,
  mrp numeric not null default 0 check (mrp >= 0),
  selling_price numeric not null default 0 check (selling_price >= 0),
  is_active boolean not null default true,
  is_subscription_allowed boolean not null default true,
  stock int not null default 0 check (stock >= 0),
  quality_info jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  address_id uuid not null references public.addresses(id),
  product_id uuid not null references public.products(id),
  quantity int not null default 1 check (quantity > 0),
  frequency text not null
    check (frequency in ('daily','alternate_days','weekdays','custom','one_time')),
  custom_days text[],
  start_date date not null,
  end_date date,
  status text not null default 'active'
    check (status in ('active','paused','cancelled','completed')),
  next_delivery_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscription_pause_dates (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  pause_date date not null,
  unique (subscription_id, pause_date)
);

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  name text,
  society_id uuid references public.societies(id),
  rider_id uuid references public.profiles(id),
  delivery_date date not null,
  status text not null default 'planned'
    check (status in ('planned','in_progress','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  address_id uuid not null references public.addresses(id),
  subscription_id uuid references public.subscriptions(id),
  delivery_date date not null,
  status text not null default 'pending'
    check (status in ('pending','packed','out_for_delivery','delivered','failed','cancelled','on_hold')),
  subtotal numeric not null default 0,
  delivery_fee numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','paid','refunded','partially_refunded','failed')),
  payment_method text,
  rider_id uuid references public.profiles(id),
  route_id uuid references public.routes(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (delivery_date, status);
create index on public.orders (user_id, delivery_date);
-- one order per subscription per day (prevents double generation)
create unique index orders_sub_day_uq on public.orders (subscription_id, delivery_date)
  where subscription_id is not null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity int not null check (quantity > 0),
  unit_price numeric not null,
  total_price numeric not null
);

create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  order_id uuid not null references public.orders(id),
  sequence int not null,
  status text not null default 'pending'
);

-- Delivery counts as successful only with photo + GPS + timestamp
create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  rider_id uuid not null references public.profiles(id),
  photo_url text,
  latitude numeric,
  longitude numeric,
  delivered_at timestamptz,
  status text not null check (status in ('delivered','failed')),
  failure_reason text
    check (failure_reason is null or failure_reason in
      ('customer_absent','gate_closed','wrong_address','refused','vehicle_issue','other')),
  notes text,
  created_at timestamptz not null default now(),
  constraint proof_required_for_delivered check (
    status <> 'delivered'
    or (photo_url is not null and latitude is not null
        and longitude is not null and delivered_at is not null)
  ),
  constraint reason_required_for_failed check (
    status <> 'failed' or failure_reason is not null
  )
);

create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric not null default 0 check (balance >= 0),  -- never negative
  auto_recharge_enabled boolean not null default false,
  auto_recharge_threshold numeric not null default 200,
  auto_recharge_amount numeric not null default 500,
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  type text not null check (type in ('credit','debit','refund','cashback','adjustment')),
  amount numeric not null check (amount > 0),
  balance_after numeric not null,
  description text,
  created_at timestamptz not null default now()
);
create index on public.wallet_transactions (user_id, created_at desc);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.orders(id),
  type text not null
    check (type in ('not_received','wrong_item','quality','billing','other')),
  description text,
  status text not null default 'open'
    check (status in ('open','in_progress','resolved','rejected')),
  refund_amount numeric,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  type text not null check (type in ('percentage','flat','free_delivery','cashback')),
  value numeric,
  min_order_value numeric default 0,
  valid_from date,
  valid_to date,
  is_active boolean not null default true
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  image_url text,
  target_url text,
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- Business settings editable by admin (cut-off, generation time, etc.)
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('order_cutoff_time', '22:00'),
  ('order_generation_time', '22:15'),
  ('timezone', 'Asia/Kolkata'),
  ('wallet_low_threshold', '200');

-- Audit logs
create table public.price_audit_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  old_price numeric,
  new_price numeric,
  changed_by uuid,
  changed_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  table_name text,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','societies','addresses','products',
                           'subscriptions','orders','wallets']
  loop
    execute format('create trigger trg_%1$s_updated before update on public.%1$s
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- role helpers (SECURITY DEFINER avoids RLS recursion) ----------
create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin','support') from public.profiles where id = auth.uid()), false)
$$;

-- ---------- new user -> profile + wallet ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, email, full_name)
  values (new.id, new.phone, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- block users from changing their own role / blocked flag
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null for the SQL Editor / service role (trusted), so the first admin can be set there
  if auth.uid() is not null and not public.is_admin() and (
       new.role is distinct from old.role
    or new.is_blocked is distinct from old.is_blocked
    or new.notes is distinct from old.notes
    or new.email is distinct from old.email) then
    raise exception 'Not allowed to change role, blocked flag, notes or email';
  end if;
  return new;
end $$;

create trigger trg_profiles_protect
before update on public.profiles
for each row execute function public.protect_profile_fields();

-- ---------- price change audit ----------
create or replace function public.log_price_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.selling_price is distinct from old.selling_price then
    insert into public.price_audit_log (product_id, old_price, new_price, changed_by)
    values (new.id, old.selling_price, new.selling_price, auth.uid());
  end if;
  return new;
end $$;

create trigger trg_products_price_audit
after update on public.products
for each row execute function public.log_price_change();

-- ---------- wallet: the ONLY way to change a balance ----------
-- p_type: credit | cashback | refund | adjustment (adds) ; debit (subtracts)
create or replace function public.wallet_apply(
  p_user uuid, p_type text, p_amount numeric,
  p_order uuid default null, p_desc text default null
) returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_balance numeric;
  v_new numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  select balance into v_balance from public.wallets
   where user_id = p_user for update;            -- row lock
  if not found then raise exception 'Wallet not found'; end if;

  if p_type = 'debit' then
    if v_balance < p_amount then
      raise exception 'Insufficient wallet balance';
    end if;
    v_new := v_balance - p_amount;
  else
    v_new := v_balance + p_amount;
  end if;

  update public.wallets set balance = v_new where user_id = p_user;
  insert into public.wallet_transactions
    (user_id, order_id, type, amount, balance_after, description)
  values (p_user, p_order, p_type, p_amount, v_new, p_desc);
  return v_new;
end $$;

revoke all on function public.wallet_apply(uuid,text,numeric,uuid,text) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid,text,numeric,uuid,text) to service_role;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','societies','addresses','categories','products',
    'subscriptions','subscription_pause_dates','routes','orders','order_items',
    'route_stops','delivery_proofs','wallets','wallet_transactions','complaints',
    'offers','banners','app_settings','price_audit_log','audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_all on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- public catalogue (readable by everyone, writable by admin)
create policy societies_read on public.societies for select using (true);
create policy societies_admin on public.societies for all
  using (public.is_admin()) with check (public.is_admin());

create policy categories_read on public.categories for select using (is_active or public.is_admin());
create policy categories_admin on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy products_read on public.products for select using (is_active or public.is_admin());
create policy products_admin on public.products for all
  using (public.is_admin()) with check (public.is_admin());

create policy offers_read on public.offers for select using (is_active or public.is_admin());
create policy offers_admin on public.offers for all
  using (public.is_admin()) with check (public.is_admin());

create policy banners_read on public.banners for select using (is_active or public.is_admin());
create policy banners_admin on public.banners for all
  using (public.is_admin()) with check (public.is_admin());

create policy settings_read on public.app_settings for select using (true);
create policy settings_admin on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- addresses
create policy addresses_own on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff on public.addresses for select using (public.is_staff());
create policy addresses_rider on public.addresses for select using (
  exists (select 1 from public.orders o
          where o.address_id = addresses.id and o.rider_id = auth.uid()));

-- subscriptions
create policy subs_own on public.subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subs_staff on public.subscriptions for all
  using (public.is_staff()) with check (public.is_staff());

create policy pause_own on public.subscription_pause_dates for all
  using (exists (select 1 from public.subscriptions s
                 where s.id = subscription_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.subscriptions s
                 where s.id = subscription_id and s.user_id = auth.uid()));
create policy pause_staff on public.subscription_pause_dates for all
  using (public.is_staff()) with check (public.is_staff());

-- orders (customers read only; creation/changes go through server functions)
create policy orders_own_read on public.orders for select using (user_id = auth.uid());
create policy orders_rider_read on public.orders for select using (rider_id = auth.uid());
create policy orders_staff on public.orders for all
  using (public.is_staff()) with check (public.is_staff());

create policy items_own on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id
          and (o.user_id = auth.uid() or o.rider_id = auth.uid())));
create policy items_staff on public.order_items for all
  using (public.is_staff()) with check (public.is_staff());

-- routes
create policy routes_rider on public.routes for select using (rider_id = auth.uid());
create policy routes_staff on public.routes for all
  using (public.is_staff()) with check (public.is_staff());

create policy stops_rider on public.route_stops for select using (
  exists (select 1 from public.routes r where r.id = route_id and r.rider_id = auth.uid()));
create policy stops_rider_update on public.route_stops for update using (
  exists (select 1 from public.routes r where r.id = route_id and r.rider_id = auth.uid()));
create policy stops_staff on public.route_stops for all
  using (public.is_staff()) with check (public.is_staff());

-- delivery proofs
create policy proofs_rider_insert on public.delivery_proofs for insert
  with check (rider_id = auth.uid() and exists (
    select 1 from public.orders o where o.id = order_id and o.rider_id = auth.uid()));
create policy proofs_rider_read on public.delivery_proofs for select
  using (rider_id = auth.uid());
create policy proofs_customer_read on public.delivery_proofs for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy proofs_staff on public.delivery_proofs for all
  using (public.is_staff()) with check (public.is_staff());

-- wallet: read-only for customers; writes only via wallet_apply()
create policy wallets_read_own on public.wallets for select using (user_id = auth.uid());
create policy wallets_update_settings on public.wallets for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wallets_staff_read on public.wallets for select using (public.is_staff());

-- stop customers editing balance directly (only the auto-recharge settings)
revoke update on public.wallets from authenticated;
grant update (auto_recharge_enabled, auto_recharge_threshold, auto_recharge_amount)
  on public.wallets to authenticated;

create policy wtx_read_own on public.wallet_transactions for select using (user_id = auth.uid());
create policy wtx_staff_read on public.wallet_transactions for select using (public.is_staff());

-- complaints
create policy complaints_own_read on public.complaints for select using (user_id = auth.uid());
create policy complaints_own_insert on public.complaints for insert
  with check (user_id = auth.uid());
create policy complaints_staff on public.complaints for all
  using (public.is_staff()) with check (public.is_staff());

-- audit logs: admin read only (written by triggers / server)
create policy price_audit_admin on public.price_audit_log for select using (public.is_admin());
create policy audit_admin on public.audit_log for select using (public.is_admin());

-- First admin: after you sign up once in the app, run this ONCE with your own id:
-- update public.profiles set role = 'admin' where phone = '+91XXXXXXXXXX';
