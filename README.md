# GharFresh

GharFresh is a mobile-first daily milk and dairy subscription frontend for Jaipur. It uses Next.js 14 (App Router), React 18, Tailwind CSS 3 and Supabase.

## Local setup

1. Install Node.js 18.17+ (Node 20 LTS recommended).
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from your Supabase project.
4. Install dependencies and start the app:

   ```bash
   npm install
   npm run dev
   ```

5. Open `http://localhost:3000/setup` to check configuration and backend access.

## Build

```bash
npm install
npm run build
npm start
```

## Render deployment

- Create a Render Web Service from the GitHub repository containing this project.
- Root directory: `gharfresh` only if you uploaded the parent folder; otherwise leave blank.
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Add environment variables from `.env.example` in Render's Environment settings.
- Set server-only variables (`SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `CRON_SECRET`) only in Render's server environment. Never add them to a `NEXT_PUBLIC_` variable or browser code.
- Review `render.yaml` and `supabase/006_schedules.sql` before enabling scheduled jobs. Configure the site URL and a strong `CRON_SECRET` as instructed in `SETUP_HINDI.md`.

## Backend safety

- The Supabase SQL files in `supabase/` are retained unchanged.
- Browser-side Supabase uses only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Wallet and order mutations must use the existing backend RPC functions; do not update wallet balances or order totals directly from the client.
- Email OTP is used. No payment gateway, phone OTP, WhatsApp, offers or banners are implemented in this version.

## Frontend polish in this revision

- Refined the customer home page hierarchy, hero, service highlights, search, category chips, product cards, empty/loading states and basket call-to-action.
- Improved shared form styles, focus visibility, reduced-motion behavior and mobile safe-area handling.
- Refined the app header and bottom navigation for clearer active states, larger touch targets and basket count visibility.
- Kept existing route structure, Supabase calls, RPC contracts, setup page and SQL files intact.

## Verification notes

This handoff environment did not connect to a live Supabase project or run a real browser session. Run `npm run build`, then test each customer, rider and admin route against a staging Supabase project before production deployment. Do not treat the UI as end-to-end verified until those checks pass.
