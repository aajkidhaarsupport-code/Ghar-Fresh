-- =====================================================================
-- GharFresh | 009 | Fix missing profiles + signup with mobile number + Jaipur
-- Run once in the SQL Editor of the GharFresh project. Safe to run again.
--
-- IMPORTANT: if you signed up BEFORE the earlier SQL files were run, your account has
-- no profile row, which makes "add address" fail and stops "make me admin" from working.
-- The backfill below repairs that.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_phone text := nullif(coalesce(new.phone, new.raw_user_meta_data->>'phone'), '');
begin
  begin
    insert into public.profiles (id, phone, email, full_name)
    values (new.id, v_phone, new.email, new.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;
  exception when unique_violation then
    -- that mobile number already belongs to another account: keep going without it
    insert into public.profiles (id, phone, email, full_name)
    values (new.id, null, new.email, new.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;
  end;
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

-- backfill: every existing login gets a profile and a wallet
insert into public.profiles (id, email, full_name, phone)
select u.id, u.email, u.raw_user_meta_data->>'full_name', null
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);

insert into public.wallets (user_id)
select p.id from public.profiles p
 where not exists (select 1 from public.wallets w where w.user_id = p.id);

update public.societies set city = 'Jaipur' where city = 'Your City';

-- ===== make yourself admin: put YOUR login email below, remove the two dashes, run =====
-- update public.profiles set role = 'admin' where lower(email) = lower('aapka-email@example.com');

select email, role, full_name from public.profiles order by created_at;
