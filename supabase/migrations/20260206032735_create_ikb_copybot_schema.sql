/*
  # IKB CopyBot Pro - Complete Database Schema

  1. New Tables
    - `managed_wallets` - User's connected wallets (Phantom, Solflare, EVM, CEX)
      - `id` (uuid, PK)
      - `chain` (text) - solana, evm
      - `label` (text) - user-friendly name
      - `address` (text) - wallet address
      - `platform` (text) - PHANTOM, SOLFLARE, EVM, CEX
      - `enabled` (boolean)
      - `created_at` (timestamptz)
    - `followed_wallets` - Wallets being tracked/copied
      - `id` (uuid, PK)
      - `chain` (text)
      - `address` (text)
      - `label` (text)
      - `score` (numeric) - ranking score
      - `score_reasons` (jsonb) - breakdown of scoring
      - `enabled` (boolean)
      - `created_at` (timestamptz)
    - `signals` - Market signals from various sources
      - `id` (uuid, PK)
      - `source` (text) - dexscreener, coingecko, helius
      - `chain` (text)
      - `token_address` (text)
      - `token_symbol` (text)
      - `meta` (jsonb) - raw signal data
      - `created_at` (timestamptz)
    - `actions` - Prepared trading actions pending user confirmation
      - `id` (uuid, PK)
      - `type` (text) - SWAP_PREPARED, ENTRY_PREPARED, EXIT_PREPARED, PAYOUT_PREPARED
      - `status` (text) - PREPARED, BUILDING, CONFIRMED, REFUSED, FAILED, EXPIRED
      - `chain` (text)
      - `strategy_id` (text)
      - `payload` (jsonb) - swap details, amounts, etc.
      - `risk_checks` (jsonb) - array of risk check results
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    - `transactions` - Executed on-chain transactions
      - `id` (uuid, PK)
      - `action_id` (uuid, FK)
      - `signature` (text)
      - `explorer_url` (text)
      - `status` (text) - PENDING, SUCCESS, FAILED
      - `created_at` (timestamptz)
    - `settings` - Application settings
      - `id` (uuid, PK)
      - `kill_switch` (boolean)
      - `risk_params` (jsonb)
      - `payout_threshold_eur` (numeric)
      - `updated_at` (timestamptz)
    - `audit_logs` - Security audit trail
      - `id` (uuid, PK)
      - `event` (text)
      - `meta` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Anon access policies for personal use (single-user setup)
*/

CREATE TABLE IF NOT EXISTS managed_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain text NOT NULL DEFAULT 'solana',
  label text NOT NULL DEFAULT '',
  address text NOT NULL,
  platform text NOT NULL DEFAULT 'PHANTOM',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS followed_wallets (
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

CREATE TABLE IF NOT EXISTS signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT '',
  chain text NOT NULL DEFAULT 'solana',
  token_address text NOT NULL DEFAULT '',
  token_symbol text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actions (
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

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid REFERENCES actions(id),
  signature text NOT NULL DEFAULT '',
  explorer_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kill_switch boolean NOT NULL DEFAULT false,
  risk_params jsonb NOT NULL DEFAULT '{"maxTradeSizeEur": 50, "maxTradesPerDay": 10, "maxSlippageBps": 300, "tokenBlacklist": [], "minLiquidityUsd": 10000}'::jsonb,
  payout_threshold_eur numeric NOT NULL DEFAULT 150,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL DEFAULT '',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE managed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE followed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select managed_wallets"
  ON managed_wallets FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert managed_wallets"
  ON managed_wallets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update managed_wallets"
  ON managed_wallets FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete managed_wallets"
  ON managed_wallets FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select followed_wallets"
  ON followed_wallets FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert followed_wallets"
  ON followed_wallets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update followed_wallets"
  ON followed_wallets FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete followed_wallets"
  ON followed_wallets FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select signals"
  ON signals FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert signals"
  ON signals FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select actions"
  ON actions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert actions"
  ON actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update actions"
  ON actions FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon select transactions"
  ON transactions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert transactions"
  ON transactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update transactions"
  ON transactions FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon select settings"
  ON settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert settings"
  ON settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update settings"
  ON settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon select audit_logs"
  ON audit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert audit_logs"
  ON audit_logs FOR INSERT TO anon WITH CHECK (true);

INSERT INTO settings (kill_switch, risk_params, payout_threshold_eur)
SELECT false, '{"maxTradeSizeEur": 50, "maxTradesPerDay": 10, "maxSlippageBps": 300, "tokenBlacklist": [], "minLiquidityUsd": 10000}'::jsonb, 150
WHERE NOT EXISTS (SELECT 1 FROM settings LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_signals_created_at ON signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_created_at ON actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_action_id ON transactions(action_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followed_wallets_score ON followed_wallets(score DESC);
