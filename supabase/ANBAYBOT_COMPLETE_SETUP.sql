-- ============================================================
-- ANBAYBOT - Secure complete Supabase bootstrap
-- Run only in the Supabase project dedicated to Anbaybot.
-- The public frontend must use the ikb-api Edge Function.
-- ============================================================

BEGIN;

-- Abort instead of silently reusing incompatible tables from another app.
DO $$
BEGIN
  IF to_regclass('public.transactions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'transactions'
         AND column_name = 'action_id'
     ) THEN
    RAISE EXCEPTION 'public.transactions exists but is not an Anbaybot table';
  END IF;

  IF to_regclass('public.actions') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'actions'
         AND column_name = 'risk_checks'
     ) THEN
    RAISE EXCEPTION 'public.actions exists but is not an Anbaybot table';
  END IF;

  IF to_regclass('public.settings') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'settings'
         AND column_name = 'kill_switch'
     ) THEN
    RAISE EXCEPTION 'public.settings exists but is not an Anbaybot table';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.managed_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL DEFAULT 'solana',
  label text NOT NULL DEFAULT '',
  address text NOT NULL,
  platform text NOT NULL DEFAULT 'PHANTOM',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.followed_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL DEFAULT 'solana',
  address text NOT NULL,
  label text NOT NULL DEFAULT '',
  score numeric NOT NULL DEFAULT 0,
  score_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  blacklisted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT '',
  chain text NOT NULL DEFAULT 'solana',
  token_address text NOT NULL DEFAULT '',
  token_symbol text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'SWAP_PREPARED',
  status text NOT NULL DEFAULT 'PREPARED',
  chain text NOT NULL DEFAULT 'solana',
  strategy_id text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid REFERENCES public.actions(id) ON DELETE SET NULL,
  signature text NOT NULL DEFAULT '',
  explorer_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kill_switch boolean NOT NULL DEFAULT true,
  risk_params jsonb NOT NULL DEFAULT '{"maxTradeSizeEur":10,"maxTradesPerDay":3,"maxSlippageBps":100,"tokenBlacklist":[],"minLiquidityUsd":10000}'::jsonb,
  payout_threshold_eur numeric NOT NULL DEFAULT 150,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.managed_wallets(id) ON DELETE CASCADE,
  token_address text NOT NULL DEFAULT 'native',
  token_symbol text NOT NULL DEFAULT 'SOL',
  balance numeric NOT NULL DEFAULT 0,
  value_usd numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_value_usd numeric NOT NULL DEFAULT 0,
  total_pnl_usd numeric NOT NULL DEFAULT 0,
  pnl_pct numeric NOT NULL DEFAULT 0,
  wallet_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auto_trade_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  allocation_pct numeric NOT NULL DEFAULT 10,
  max_loss_pct numeric NOT NULL DEFAULT 5,
  auto_stop_loss boolean NOT NULL DEFAULT true,
  trader_mode text NOT NULL DEFAULT 'semi',
  selected_traders jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  risk_tolerance text NOT NULL DEFAULT 'moderate',
  auto_rebalance boolean NOT NULL DEFAULT false,
  rebalance_interval_hours integer NOT NULL DEFAULT 24,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_recommendation jsonb,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON public.signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_status ON public.actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_created_at ON public.actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_action_id ON public.transactions(action_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followed_wallets_score ON public.followed_wallets(score DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_balances_unique ON public.wallet_balances(wallet_id, token_address);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_wallet ON public.wallet_balances(wallet_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_created ON public.portfolio_snapshots(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_trade_config_strategy ON public.auto_trade_config(strategy_id);

ALTER TABLE public.managed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_trade_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'managed_wallets','followed_wallets','signals','actions','transactions',
        'settings','audit_logs','wallet_balances','portfolio_snapshots',
        'auto_trade_config','ai_config'
      ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END $$;

REVOKE ALL ON TABLE
  public.managed_wallets,
  public.followed_wallets,
  public.signals,
  public.actions,
  public.transactions,
  public.settings,
  public.audit_logs,
  public.wallet_balances,
  public.portfolio_snapshots,
  public.auto_trade_config,
  public.ai_config
FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.managed_wallets,
  public.followed_wallets,
  public.signals,
  public.actions,
  public.transactions,
  public.settings,
  public.audit_logs,
  public.wallet_balances,
  public.portfolio_snapshots,
  public.auto_trade_config,
  public.ai_config
TO service_role;

INSERT INTO public.settings (kill_switch, risk_params, payout_threshold_eur)
SELECT true,
       '{"maxTradeSizeEur":10,"maxTradesPerDay":3,"maxSlippageBps":100,"tokenBlacklist":[],"minLiquidityUsd":10000}'::jsonb,
       150
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

INSERT INTO public.ai_config (
  enabled, risk_tolerance, auto_rebalance, rebalance_interval_hours, parameters
)
SELECT false,
       'moderate',
       false,
       24,
       '{"scoring_weight":0.6,"momentum_weight":0.3,"risk_weight":0.1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.ai_config);

COMMIT;
