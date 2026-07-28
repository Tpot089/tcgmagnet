# TCG Magnet

Standalone lead-generation website for TCG Magnet.

## Core Routes

- `/` and `/tcg-magnet`: public collection-buying landing page and submission form
- `/tcg-magnet/confirmation`: submission confirmation
- `/ops/tcg-leads`: authenticated internal lead portal
- `/staff-login`: Supabase email/password staff login

## Setup

1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project.
3. Run `supabase/migrations/20260727_create_tcg_magnet_leads.sql`.
4. Add the same environment variables in Vercel.
5. Add ops user emails to `NEXT_PUBLIC_OPS_ALLOWLIST`.
6. Configure Postmark sender and `TCG_MAGNET_LEAD_NOTIFY_EMAIL`.

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
