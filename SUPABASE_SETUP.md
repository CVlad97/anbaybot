# Supabase Setup

## Project

- Name: `IKABAY`
- Project Ref: `luqvqwpglceeqtbbtvuo`
- Status required before changes: `ACTIVE_HEALTHY`

## What Exists Locally

- `supabase/migrations/20260206032735_create_ikb_copybot_schema.sql`
- `supabase/migrations/20260206185006_add_portfolio_autotrade_ai_tables.sql`
- `supabase/migrations/20260509231000_harden_real_mode_security.sql`
- `supabase/functions/ikb-api/index.ts`

## Important Drift

- The remote database already contains unrelated `kaygo` and other public objects.
- The local Anbaybot schema is not fully applied to the remote project.
- `public.transactions` already exists remotely with a different structure from the local migration target.

## Recommended Procedure

1. Verify the project status is still `ACTIVE_HEALTHY`.
2. Compare the current remote schema with the local migrations.
3. Resolve name collisions before applying new DDL.
4. Keep `ALLOW_LIVE_TRADING=false`.
5. Deploy `ikb-api` only after schema compatibility is confirmed.

## RLS

- Do not leave public write policies on private operational tables.
- Do not expose admin-only settings to `anon` or `authenticated`.
- Keep audit and private tables server-side only.

