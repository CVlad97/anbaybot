# Manual Setup Checklist

## Must do manually

- Configure Supabase Edge Function secrets:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `ANBAYBOT_ADMIN_TOKEN`
  - `BINANCE_API_KEY`
  - `BINANCE_API_SECRET`
  - `ALLOW_LIVE_TRADING=false` until you are ready to go live
- Deploy the `ikb-api` Edge Function and verify `/health` returns `real_edge`
- Apply Supabase migrations for:
  - `managed_wallets`
  - `followed_wallets`
  - `signals`
  - `actions`
  - `transactions`
  - `settings`
  - `audit_logs`
  - `wallet_balances`
  - `portfolio_snapshots`
  - `auto_trade_config`
  - `ai_config`
- Add GitHub Pages environment variables:
  - `VITE_BACKEND_API_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` if client access is needed
  - `VITE_SOLANA_RPC_URL` if you want a custom RPC
  - `VITE_ETHEREUM_RPC_URL` if you want a custom EVM RPC
  - `VITE_STRIPE_PRO_PAYMENT_LINK`
  - `VITE_STRIPE_ENTERPRISE_PAYMENT_LINK`
- Create the real Stripe payment links or Checkout Sessions for Pro and Enterprise
- Test wallet connections on the target browser and mobile wallet browsers
- Re-check CI and the GitHub Pages deployment after each config change

## Useful tools and plugins

- GitHub: inspect repo state, push changes, review Actions, and manage PRs
- Stripe: verify the correct payment integration path and avoid deprecated APIs
- Cloudflare: if you move the backend off Supabase or add edge logic
- Build Web Apps: if the front-end needs more UI or workflow fixes

## Verification loop

1. Update config manually.
2. Re-run `npm run lint`, `npm run typecheck`, and `npm run build`.
3. Confirm GitHub Actions is green.
4. Open the GitHub Pages URL and test wallet / subscription flows.

