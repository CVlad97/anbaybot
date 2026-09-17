/* ANBAYBOT production-safe defaults for every future deployment. */

UPDATE settings
SET kill_switch = true,
    updated_at = now();

UPDATE ai_config
SET enabled = false,
    auto_rebalance = false,
    updated_at = now();

UPDATE auto_trade_config
SET enabled = false,
    trader_mode = 'semi',
    updated_at = now();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'managed_wallets','followed_wallets','signals','actions','transactions',
    'settings','audit_logs','wallet_balances','portfolio_snapshots',
    'auto_trade_config','ai_config','trade_ledger','pnl_ledger','audit_ledger'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

COMMENT ON TABLE settings IS 'ANBAYBOT runtime settings. Production migrations intentionally default kill_switch to true.';
