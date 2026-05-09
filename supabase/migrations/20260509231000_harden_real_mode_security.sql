/*
  Harden Anbaybot production mode.

  The public frontend must not write directly to Supabase tables with anon
  permissions. All operational reads/writes go through the ikb-api Edge
  Function using SUPABASE_SERVICE_ROLE_KEY and an admin cockpit token.
*/

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'managed_wallets',
        'followed_wallets',
        'signals',
        'actions',
        'transactions',
        'settings',
        'audit_logs',
        'wallet_balances',
        'portfolio_snapshots',
        'auto_trade_config',
        'ai_config'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

ALTER TABLE managed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_trade_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON managed_wallets FROM anon, authenticated;
REVOKE ALL ON followed_wallets FROM anon, authenticated;
REVOKE ALL ON signals FROM anon, authenticated;
REVOKE ALL ON actions FROM anon, authenticated;
REVOKE ALL ON transactions FROM anon, authenticated;
REVOKE ALL ON settings FROM anon, authenticated;
REVOKE ALL ON audit_logs FROM anon, authenticated;
REVOKE ALL ON wallet_balances FROM anon, authenticated;
REVOKE ALL ON portfolio_snapshots FROM anon, authenticated;
REVOKE ALL ON auto_trade_config FROM anon, authenticated;
REVOKE ALL ON ai_config FROM anon, authenticated;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
