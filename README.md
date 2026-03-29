# Essy Singer - Netlify Functions + Supabase Database

This project is a static site (`HTML + Tailwind CDN + Vanilla JS`) hosted on Netlify.

Supabase remains the database, but the server runtime now lives in Netlify Functions. That means:

- Supabase secrets stay in Netlify environment variables
- the browser talks to same-origin Netlify routes like `/content-get` and `/mpesa-stk-push`
- no Supabase service key is stored in the repo

## 1) Database setup

1. Create or open your Supabase project.
2. If you want a full clean restart, run [supabase/reset.sql](./supabase/reset.sql) in the SQL editor.
3. If you only want to create missing tables without dropping data, run [supabase/schema.sql](./supabase/schema.sql) instead.
4. If you want the database to start with the current bundled site content, run [supabase/seed-content.sql](./supabase/seed-content.sql) after the reset/schema step.

The database tables used by the site are:

- `tickets`
- `scan_logs`
- `mpesa_intents`
- `contact_inquiries`
- `site_content`

## 2) Netlify environment variables

Set these in Netlify Site Settings -> Environment Variables.

You can use [.env.example](./.env.example) as the checklist of variables to add.

Required database/runtime values:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `QR_JWT_SECRET`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

Recommended app values:

- `ADMIN_API_KEY`
- `TICKET_DOWNLOAD_SECRET`
- `PAYMENT_WEBHOOK_SECRET`
- `VALIDATE_RATE_LIMIT_MAX`
- `VALIDATE_RATE_LIMIT_WINDOW_MS`
- `SITE_BASE_URL`

M-Pesa / Daraja:

- `MPESA_ENABLED`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`
- `MPESA_BASE_URL`

Optional delivery values:

- `EMAIL_FROM`
- `RESEND_API_KEY`
- `BOOKING_NOTIFY_EMAIL`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

## 3) Netlify functions used by the site

The frontend uses these same-origin routes:

- `POST /admin-login`
- `GET /admin-auth-check`
- `GET /content-get?path=/content/*.json`
- `POST /content-upsert`
- `GET /ticket-availability`
- `POST /mpesa-stk-push`
- `POST /mpesa-callback`
- `POST /payment-webhook`
- `POST /contact-submit`
- `POST /validate-ticket`
- `GET /admin-tickets`
- `GET /admin-inquiries`
- `GET /tickets-download?token=...`
- `GET /tickets-verify?ticketId=...`

These routes are mapped in [netlify.toml](./netlify.toml) to files in [netlify/functions](./netlify/functions).

## 4) Frontend configuration

[content/settings.json](./content/settings.json) intentionally keeps the API section blank by default:

- `api.functionsBaseUrl`
- `api.supabaseAnonKey`

On Netlify, the site uses same-origin routes automatically, so you do not need to commit a function base URL or public key into GitHub.

## 5) Admin/content workflow

- Open `/admin/editor.html`
- Click `Load All`
- Edit content
- Click `Save` or `Save All`

Content is read from `site_content` in Supabase when available, with bundled `content/*.json` files as static fallback.

If you ran `reset.sql` and want the editor/site to immediately use database-backed content again, run `seed-content.sql` first.

## 6) Ticket flow

- Event availability is read from Supabase ticket counts
- M-Pesa checkout is initiated by Netlify Functions
- successful payments create tickets in Supabase
- ticket download links are signed
- QR verification and check-in happen through Netlify Functions

## 7) Contact flow

- Website booking requests are submitted through `/contact-submit`
- requests are stored in `contact_inquiries`
- admin can review them from `/inquiries-dashboard.html`
- optional notification emails can be sent with `RESEND_API_KEY`, `EMAIL_FROM`, and `BOOKING_NOTIFY_EMAIL`

## 8) Important note

Do not commit secrets to GitHub.

Only put sensitive values in Netlify environment variables. The repo should contain code and non-secret content only.

## 9) Recommended restart order

1. Run [supabase/reset.sql](./supabase/reset.sql) in Supabase if you want a full wipe.
2. Run [supabase/seed-content.sql](./supabase/seed-content.sql) if you want to restore the current default site content into `site_content`.
3. Add the required variables from [.env.example](./.env.example) to Netlify.
4. Redeploy the site on Netlify.
5. Open `/admin/editor.html`, log in, click `Load All`, and confirm sections load from the site content database.
