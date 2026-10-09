# ANBAYBOT — Multi-wallet revenue operations

## Objective
Build a complete read-only portfolio, identify real yield opportunities, and route realized profits toward Revolut in EUR when verified.

## Safety rules
- Never store or request seed phrases, private keys, wallet passwords, OTPs or recovery codes.
- Never sign or broadcast a blockchain transaction automatically.
- Never count a candidate address as owned until control is confirmed.
- Never use addresses listed in config/wallet-registry.public.json -> blocked.
- Never send USDT directly to Revolut; use a verified EUR/SEPA off-ramp.

## Automated cycle
1. Run scripts/wallet_inventory_audit.py every 4 hours.
2. Read confirmed wallets only for portfolio totals.
3. Value native assets and known liquid tokens using reputable market data.
4. Flag candidates with non-zero balances for manual ownership confirmation.
5. Ignore dust when expected fees exceed expected 30-day yield.
6. Log opportunities; do not execute them.

## Current priority
1. Trust Wallet TRON: verify USDT balance, compare JustLend jUSDT yield, prepare small test only.
2. Binance/MEXC: complete private API READ_ONLY -> TEST_READY; withdrawals remain disabled.
3. Kraken/Coinbase/Revolut X: recover account access and read balances before any strategy.
4. Phantom/Solflare: monitor balances; no yield if balance is uneconomic.
5. Revolut: payout destination is verified EUR/SEPA only.

## Payout rule
A 1000 EUR payout is eligible only when a verified source account has >=1000 EUR available after fees/tax reserve and the Revolut beneficiary is verified. Prepare the transfer, but require the user to confirm the final financial transaction.
