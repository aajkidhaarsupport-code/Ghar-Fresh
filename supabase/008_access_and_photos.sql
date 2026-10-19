-- =====================================================================
-- GharFresh | 008 | Table access (GRANTs) + product photo storage
-- Run once in the SQL Editor of the GharFresh project. Safe to run again.
--
-- Why: RLS decides WHICH rows a person may touch, but the database role also needs
-- permission to touch the table at all. Some newer Supabase projects do not give that
-- automatically, which shows up as empty lists, "permission denied", or adds that silently fail.
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- visitors who are not logged in may only READ the public catalogue
grant select on public.societies, public.categories, public.products,
                public.offers, public.banners, public.app_settings to anon;

-- logged-in users: RLS policies still decide which rows
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- re-lock tables that must only change through the safe server functions
revoke insert, update, delete on public.wallets from authenticated;
grant update (auto_recharge_enabled, auto_recharge_threshold, auto_recharge_amount)
  on public.wallets to authenticated;
revoke insert, update, delete on public.wallet_transactions from authenticated;
revoke insert, update, delete on public.price_audit_log from authenticated;
revoke insert, update, delete on public.audit_log from authenticated;
revoke insert, update, delete on public.notifications from authenticated;

-- ---------- public bucket for product photos (admin uploads, everyone can view) ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "admin uploads product images" on storage.objects;
drop policy if exists "admin updates product images" on storage.objects;
drop policy if exists "admin deletes product images" on storage.objects;

create policy "product images public read" on storage.objects for select
  using (bucket_id = 'product-images');
create policy "admin uploads product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin updates product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
create policy "admin deletes product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- quick check: should show your role as admin and the counts
select (select string_agg(email || ' = ' || role, ', ') from public.profiles) as roles,
       (select count(*) from public.societies) as areas,
       (select count(*) from public.products) as products;
