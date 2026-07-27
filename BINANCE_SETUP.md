# Binance Setup

## Safe Mode

- `ALLOW_LIVE_TRADING=false` by default.
- Live execution must stay disabled until a human explicitly approves it.
- The frontend must never be allowed to place real orders directly.

## Required Server Controls

- API key and secret stored only in Supabase secrets.
- Signed requests use timestamp and `recvWindow`.
- Allowed symbols are whitelisted server-side.
- Live orders require the exact confirmation phrase.
- Withdrawals must remain disabled on the Binance API key.

## Current Code Behavior

- Public price data is read from Binance public endpoints.
- Account snapshots are read only when server secrets are present.
- Test orders use the Binance `/api/v3/order/test` endpoint.
- Live orders are blocked unless server-side live trading is enabled.

## Manual Checks

1. Confirm the API key has no withdrawal permission.
2. Confirm IP restrictions, if used, match the backend host.
3. Confirm allowed symbols match your intended safe list.
4. Confirm the live switch remains off.

