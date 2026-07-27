# Testing

## Automated Checks

Run from the repo root:

```bash
npm install
npm run lint
npm run typecheck
npm run build
npm audit
```

## Manual Smoke Tests

- Open the GitHub Pages site and refresh a deep route.
- Connect Phantom or Solflare on a desktop browser.
- Open the wallet deeplink path on mobile.
- Verify the dashboard shows simulation when live trading is off.
- Verify Pro and Enterprise buttons stay disabled when Stripe links are missing.
- Verify wallet balances render after connecting wallets.
- Verify the backend health route returns `real_edge` only after the Edge Function is deployed.

## Negative Cases

- No wallet installed.
- Backend unavailable.
- Missing Supabase variables.
- Missing Stripe links.
- Live order attempt while `ALLOW_LIVE_TRADING=false`.
- Invalid admin token.

