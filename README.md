# TCG Magnet

Standalone lead-generation website for TCG Magnet.

## Core Routes

- `/` and `/tcg-magnet`: public collection-buying landing page and submission form
- `/tcg-magnet/confirmation`: submission confirmation
- `/ops/tcg-leads`: authenticated internal lead portal
- `/staff-login`: Supabase email/password staff login

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/20260727_create_tcg_magnet_leads.sql`.
3. Add the required environment variables in Vercel and local `.env.local`.
4. Add ops user emails to `NEXT_PUBLIC_OPS_ALLOWLIST`.
5. Configure Postmark sender and `TCG_MAGNET_LEAD_NOTIFY_EMAIL`.

## Required Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
POSTMARK_SERVER_TOKEN=
POSTMARK_FROM_EMAIL=
POSTMARK_REPLY_TO=
TCG_MAGNET_LEAD_NOTIFY_EMAIL=
TCG_MAGNET_INTERNAL_BASE_URL=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_OPS_ALLOWLIST=
OPS_ADMIN_EMAILS=
NEXT_PUBLIC_GOOGLE_ADS_ID=
NEXT_PUBLIC_TCG_GOOGLE_ADS_SEND_TO=
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run typecheck
npm run build
```
