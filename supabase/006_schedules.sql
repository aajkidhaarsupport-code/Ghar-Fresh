-- =====================================================================
-- GharFresh | Migration 006 | Schedules (run LAST, after the app is live on Render)
-- 1) In Supabase: Database > Extensions > enable pg_cron and pg_net
-- 2) Replace YOUR-APP and YOUR_CRON_SECRET below, then run.
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 10:15 PM IST = 16:45 UTC : generate tomorrow's orders from active subscriptions
select cron.schedule('gf-generate-orders', '45 16 * * *',
  $$ select public.generate_next_day_orders(); $$);

-- every minute: ask the website to send queued emails (Brevo)
select cron.schedule('gf-send-notifications', '* * * * *',
  $$ select net.http_post(
       url := 'https://YOUR-APP.onrender.com/api/notify',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET',
                                     'Content-Type', 'application/json'),
       body := '{}'::jsonb); $$);

-- To stop a job later:  select cron.unschedule('gf-generate-orders');
