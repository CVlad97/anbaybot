/*
  # Portfolio tracking, auto-trade configuration, and AI management

  1. New Tables
    - `wallet_balances` - Cached token balances per managed wallet
      - `id` (uuid, PK)
      - `wallet_id` (uuid, FK to managed_wallets)
      - `token_address` (text) - 'native' or SPL/ERC20 contract address
      - `token_symbol` (text) - SOL, ETH, USDC, etc.
      - `balance` (numeric) - raw token amount
      - `value_usd` (numeric) - estimated USD value
      - `updated_at` (timestamptz)
    - `portfolio_snapshots` - Historical portfolio value snapshots for P&L tracking
      - `id` (uuid, PK)
      - `total_value_usd` (numeric) - total portfolio value at snapshot time
      - `total_pnl_usd` (numeric) - P&L since previous snapshot
      - `pnl_pct` (numeric) - P&L percentage
      - `wallet_breakdown` (jsonb) - per-wallet value breakdown
      - `created_at` (timestamptz)
    - `auto_trade_config` - Per-strategy auto-trade settings
      - `id` (uuid, PK)
      - `strategy_id` (text) - references strategy plugin ID
      - `enabled` (boolean) - whether auto-trade is active
      - `allocation_pct` (numeric) - % of total portfolio to allocate
      - `max_loss_pct` (numeric) - max loss before auto-stop
      - `auto_stop_loss` (boolean) - enable automatic stop-loss
      - `trader_mode` (text) - 'auto', 'manual', or 'semi'
      - `selected_traders` (jsonb) - IDs of followed wallets to copy
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `ai_config` - AI algorithm management settings
      - `id` (uuid, PK)
      - `enabled` (boolean) - master AI switch
      - `risk_tolerance` (text) - conservative, moderate, aggressive
      - `auto_rebalance` (boolean) - auto-rebalance portfolio
      - `rebalance_interval_hours` (integer) - hours between rebalances
      - `parameters` (jsonb) - custom AI parameters
      - `last_recommendation` (jsonb) - last AI recommendation output
      - `last_run_at` (timestamptz) - last AI evaluation time
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all new tables
    - Anon access policies for single-user personal setup

  3. Indexes
    - wallet_balances(wallet_id)
    - wallet_balances unique on (wallet_id, token_address)
    - portfolio_snapshots(created_at DESC)
    - auto_trade_config(strategy_id) unique
*/

CREATE TABLE IF NOT EXISTS wallet_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES managed_wallets(id) ON DELETE CASCADE,
  token_address text NOT NULL DEFAULT 'native',
  token_symbol text NOT NULL DEFAULT 'SOL',
  balance numeric NOT NULL DEFAULT 0,
  value_usd numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_value_usd numeric NOT NULL DEFAULT 0,
  total_pnl_usd numeric NOT NULL DEFAULT 0,
  pnl_pct numeric NOT NULL DEFAULT 0,
  wallet_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auto_trade_config (
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

CREATE TABLE IF NOT EXISTS ai_config (
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

ALTER TABLE wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_trade_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_balances_unique ON wallet_balances(wallet_id, token_address);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_wallet ON wallet_balances(wallet_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_created ON portfolio_snapshots(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_trade_config_strategy ON auto_trade_config(strategy_id);

CREATE POLICY "Allow anon select wallet_balances"
  ON wallet_balances FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert wallet_balances"
  ON wallet_balances FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update wallet_balances"
  ON wallet_balances FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete wallet_balances"
  ON wallet_balances FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select portfolio_snapshots"
  ON portfolio_snapshots FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert portfolio_snapshots"
  ON portfolio_snapshots FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select auto_trade_config"
  ON auto_trade_config FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert auto_trade_config"
  ON auto_trade_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update auto_trade_config"
  ON auto_trade_config FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete auto_trade_config"
  ON auto_trade_config FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select ai_config"
  ON ai_config FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert ai_config"
  ON ai_config FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update ai_config"
  ON ai_config FOR UPDATE TO anon USING (true) WITH CHECK (true);

INSERT INTO ai_config (enabled, risk_tolerance, auto_rebalance, rebalance_interval_hours, parameters)
SELECT false, 'moderate', false, 24, '{"scoring_weight": 0.6, "momentum_weight": 0.3, "risk_weight": 0.1}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM ai_config LIMIT 1);
