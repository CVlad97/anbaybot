# Environment Matrix

## Frontend Variables

| Variable | Used | Scope | Secret | Required | Where to set | If missing |
|---|---|---|---|---|---|---|
| `VITE_BASE_PATH` | Yes | Frontend build | No | Yes for GitHub Pages | GitHub Actions variables | Broken base path / refresh behavior |
| `VITE_APP_BASE_URL` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Wallet deeplinks fall back to current origin |
| `VITE_BACKEND_API_URL` | Yes | Frontend runtime | No | No if `VITE_SUPABASE_URL` is set | GitHub Actions variables or `.env` | Frontend falls back to local/demo mode |
| `VITE_SUPABASE_URL` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Backend URL fallback is unavailable |
| `VITE_SUPABASE_ANON_KEY` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Frontend cannot use Supabase client features |
| `VITE_SOLANA_RPC_URL` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Solana RPC falls back to public endpoint |
| `VITE_ETHEREUM_RPC_URL` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | EVM wallet RPC falls back to public endpoint |
| `VITE_BASE_BLOCKSCOUT_API_URL` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Base balances fall back to public Blockscout |
| `VITE_ETH_BLOCKSCOUT_API_URL` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Ethereum balances fall back to public Blockscout |
| `VITE_STRIPE_PRO_PAYMENT_LINK` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Pro button is disabled |
| `VITE_STRIPE_ENTERPRISE_PAYMENT_LINK` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Enterprise button is disabled |
| `VITE_ENABLE_TX_SIGNING` | Yes | Frontend runtime | No | No | GitHub Actions variables or `.env` | Wallet-side signing stays disabled |

## Backend Secrets

| Variable | Used | Scope | Secret | Required | Where to set | If missing |
|---|---|---|---|---|---|---|
| `SUPABASE_URL` | Yes | Supabase Edge Function | No | Yes for `ikb-api` | Supabase project secrets | Function cannot create a Supabase client |
| `SUPABASE_ANON_KEY` | No | Supabase Edge Function | No | No | Not currently used by code | No effect today |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase Edge Function | Yes | Yes for `ikb-api` | Supabase project secrets | Server writes and admin reads fail |
| `ANBAYBOT_ADMIN_TOKEN` | Yes | Supabase Edge Function | Yes | Yes for protected routes | Supabase project secrets | Protected routes return 401/503 |
| `ANBAYBOT_ALLOWED_ORIGINS` | Yes | Supabase Edge Function | No | No | Supabase project secrets | CORS falls back to built-in defaults |
| `MEXC_BASE_URL` | Yes | Supabase Edge Function | No | No | Supabase project secrets | MEXC defaults to `https://api.mexc.com` |
| `MEXC_API_KEY` | Yes | Supabase Edge Function | Yes | Required for account/order endpoints | Supabase project secrets | Signed MEXC routes fail |
| `MEXC_API_SECRET` | Yes | Supabase Edge Function | Yes | Required for account/order endpoints | Supabase project secrets | Signed MEXC routes fail |
| `MEXC_RECV_WINDOW` | Yes | Supabase Edge Function | No | No | Supabase project secrets | Defaults to `5000` |
| `MEXC_ALLOWED_SYMBOLS` | Yes | Supabase Edge Function | No | No | Supabase project secrets | Order validation falls back to default symbols |
| `ALLOW_LIVE_TRADING` | Yes | Supabase Edge Function | No | Must stay `false` | Supabase project secrets | Live orders stay blocked |
| `MAX_TRADE_USDT` | Yes | Supabase Edge Function | No | No | Supabase project secrets | Defaults to `10` |
| `ANBAYBOT_MAX_STABLE_CAPITAL_PCT` | Yes | Supabase Edge Function | No | No | Supabase project secrets | Defaults to `0.9` |
| `ANBAYBOT_MIN_MOMENTUM_PCT` | Yes | Supabase Edge Function | No | No | Supabase project secrets | Defaults to `2` |
| `CONFIRMATION_PHRASE` | Yes | Supabase Edge Function | No | No | Supabase project secrets | Defaults to the French confirmation phrase |

## Not Used In Current Code

- `VITE_WALLETCONNECT_PROJECT_ID`
- MEXC does not provide a testnet setting in this integration; use order-test/paper mode first.
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
