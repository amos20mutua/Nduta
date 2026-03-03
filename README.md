# Essy Singer - Supabase Database + Edge Functions

This project is a static site (`HTML + Tailwind CDN + Vanilla JS`) with ticketing backed by Supabase.

The Netlify function layer has been replaced with Supabase Edge Functions.

## 1) Supabase setup

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor.
3. Deploy edge functions from this repo:
   - `create-ticket`
   - `validate-ticket`
   - `payment-webhook`
   - `mpesa-stk-push`
   - `mpesa-callback`
   - `admin-tickets`
   - `content-get`
   - `content-upsert`
   - `tickets-download`
   - `tickets-verify`

`supabase/config.toml` is included with `verify_jwt = false` for browser/webhook access patterns used by this site.

## 2) Environment variables (Supabase Edge Functions)

Set these in Supabase project secrets:

- `PROJECT_SUPABASE_URL` (recommended custom var) or built-in `SUPABASE_URL`
- `PROJECT_SERVICE_ROLE_KEY` (recommended custom var) or built-in `SUPABASE_SERVICE_ROLE_KEY`
- `QR_JWT_SECRET`
- `TICKET_DOWNLOAD_SECRET` (recommended, fallback is `QR_JWT_SECRET`)
- `PAYMENT_WEBHOOK_SECRET`
- `VALIDATE_RATE_LIMIT_MAX` (example: `30`)
- `VALIDATE_RATE_LIMIT_WINDOW_MS` (example: `60000`)
- `ADMIN_API_KEY` (recommended for scanner/dashboard protection)
- `CONTENT_BASE_URL` (public base URL where this site is hosted, used to load `/content/events.json`)
- `MPESA_ENABLED` (`true`/`false`, default `true`)
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL` (must point to your deployed `mpesa-callback` function URL)
- `MPESA_BASE_URL` (optional, default `https://sandbox.safaricom.co.ke`)
- `DARAJA_CONSUMER_KEY`
- `DARAJA_CONSUMER_SECRET`
- `DARAJA_PASSKEY`
- `DARAJA_SHORTCODE`
- `DARAJA_CALLBACK_URL`
- `DARAJA_BASE_URL` (optional)
- `FUNCTIONS_BASE_URL` (optional; used to build ticket download links)
- `EMAIL_FROM`
- `RESEND_API_KEY` (recommended email provider for Edge runtime)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS` (accepted; if SMTP is used externally)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (optional WhatsApp delivery)

## 3) Frontend API configuration

Set these in `content/settings.json` (or via CMS settings):

- `api.functionsBaseUrl`  
  Example: `https://YOUR-PROJECT.functions.supabase.co`
- `api.supabaseAnonKey`  
  Your Supabase public anon key (used only for calling edge functions from browser).

Client pages now call:

- `POST {functionsBaseUrl}/mpesa-stk-push`
- `POST {functionsBaseUrl}/validate-ticket`
- `GET {functionsBaseUrl}/admin-tickets`
- `GET {functionsBaseUrl}/content-get?path=/content/*.json`
- `POST {functionsBaseUrl}/content-upsert`
- `GET {functionsBaseUrl}/tickets-download?token=...`
- `GET {functionsBaseUrl}/tickets-verify?ticketId=...`

## 4) Scanner and dashboard access

- [`scan.html`](./scan.html) now uses an admin key field instead of Netlify Identity.
- [`tickets-dashboard.html`](./tickets-dashboard.html) uses admin key + optional event filter and CSV export.
- [`admin/editor.html`](./admin/editor.html) is an Easy Form Mode full-site editor for non-technical users (with optional Advanced JSON per section).
- If `ADMIN_API_KEY` is set in Supabase secrets, scanner/dashboard require that key.

## 5) Notes

- `netlify/functions/*` is kept in the repo only as legacy reference.
- Decap CMS files under `admin/` are unchanged by this migration.
- Events visibility controls:
  - Global toggle: `content/settings.json -> eventsPage.enabled`
  - Per-event toggle: `content/events.json -> items[].enabled`
  - If disabled or no upcoming enabled events, `events.html` shows “No Upcoming Events”.

## 6) Connection checklist (frontend + backend)

1. Run `supabase/schema.sql` (includes ticket tables + `site_content`).
2. Deploy all edge functions listed above.
3. Set Supabase secrets/env vars from this README.
4. Set `content/settings.json -> api.functionsBaseUrl` and `api.supabaseAnonKey`.
5. Open `/admin/editor.html`, click `Load All`, then `Save All` once to confirm DB content write works.

## 7) Ticket delivery

- After successful paid ticket issuance, the backend now:
  - creates a signed 48-hour ticket download token
  - sends ticket email (when email provider is configured)
  - sends WhatsApp download link (when Twilio WhatsApp is configured)
- Download endpoint returns a generated PDF ticket:
  - `GET /tickets-download?token=...`
- Verification endpoint:
  - `GET /tickets-verify?ticketId=...`
