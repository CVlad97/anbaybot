/*
  ANBAYBOT — registres financiers isolés et immuables.

  Objectifs:
  - séparer strictement exécution, P&L et audit;
  - distinguer LIVE / PAPER / TEST;
  - empêcher UPDATE/DELETE sur l'historique financier;
  - réserver les écritures au backend service_role;
  - chaîner l'audit par SHA-256, sérialisé en transaction.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS trade_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  environment text NOT NULL CHECK (environment IN ('LIVE','PAPER','TEST')),
  venue text NOT NULL,
  instrument_type text NOT NULL CHECK (instrument_type IN ('SPOT','FUTURES','PERPETUAL','PREDICTION','DEX','OTHER')),
  market text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('ORDER_PREPARED','ORDER_SUBMITTED','ORDER_ACCEPTED','PARTIAL_FILL','FILL','CANCEL','REJECT','SETTLEMENT','ADJUSTMENT')),
  side text CHECK (side IS NULL OR side IN ('BUY','SELL','YES','NO')),
  strategy_id text,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_order_id text,
  external_trade_id text,
  wallet_or_account_ref text,
  quantity numeric,
  quote_amount numeric,
  execution_price numeric,
  fee_amount numeric NOT NULL DEFAULT 0,
  fee_asset text,
  raw_status text,
  source text NOT NULL DEFAULT 'anbaybot',
  source_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (quantity IS NULL OR quantity >= 0),
  CHECK (quote_amount IS NULL OR quote_amount >= 0),
  CHECK (execution_price IS NULL OR execution_price >= 0),
  CHECK (fee_amount >= 0)
);

CREATE TABLE IF NOT EXISTS pnl_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  environment text NOT NULL CHECK (environment IN ('LIVE','PAPER','TEST')),
  venue text NOT NULL,
  market text,
  pnl_type text NOT NULL CHECK (pnl_type IN ('REALIZED','UNREALIZED_SNAPSHOT','FEE','FUNDING','SETTLEMENT','ADJUSTMENT')),
  correlation_id uuid,
  trade_ledger_id uuid REFERENCES trade_ledger(id),
  gross_pnl_usd numeric NOT NULL DEFAULT 0,
  fees_usd numeric NOT NULL DEFAULT 0,
  funding_usd numeric NOT NULL DEFAULT 0,
  net_pnl_usd numeric NOT NULL,
  equity_usd numeric,
  source text NOT NULL DEFAULT 'anbaybot',
  source_ref text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS audit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  severity text NOT NULL DEFAULT 'INFO' CHECK (severity IN ('DEBUG','INFO','WARNING','ERROR','CRITICAL')),
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'SYSTEM' CHECK (actor_type IN ('SYSTEM','USER','VENUE','JOB','API')),
  actor_ref text,
  correlation_id uuid,
  request_id text,
  source text NOT NULL DEFAULT 'anbaybot',
  source_ref text,
  sanitized_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  event_hash text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_trade_ledger_time ON trade_ledger(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_ledger_corr ON trade_ledger(correlation_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_trade_ledger_venue_market ON trade_ledger(venue, market, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_ledger_source_ref ON trade_ledger(source, source_ref) WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pnl_ledger_time ON pnl_ledger(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnl_ledger_corr ON pnl_ledger(correlation_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_pnl_ledger_environment ON pnl_ledger(environment, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pnl_ledger_trade_ledger_id ON pnl_ledger(trade_ledger_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pnl_ledger_source_ref ON pnl_ledger(source, source_ref) WHERE source_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_ledger_time ON audit_ledger(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ledger_corr ON audit_ledger(correlation_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_ledger_event_hash ON audit_ledger(event_hash);

ALTER TABLE trade_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE pnl_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON trade_ledger FROM anon, authenticated;
REVOKE ALL ON pnl_ledger FROM anon, authenticated;
REVOKE ALL ON audit_ledger FROM anon, authenticated;
GRANT SELECT, INSERT ON trade_ledger TO service_role;
GRANT SELECT, INSERT ON pnl_ledger TO service_role;
GRANT SELECT, INSERT ON audit_ledger TO service_role;

CREATE OR REPLACE FUNCTION reject_financial_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'ANBAYBOT financial ledgers are append-only; write a compensating entry instead';
END;
$$;

DROP TRIGGER IF EXISTS trg_trade_ledger_immutable ON trade_ledger;
CREATE TRIGGER trg_trade_ledger_immutable BEFORE UPDATE OR DELETE ON trade_ledger FOR EACH ROW EXECUTE FUNCTION reject_financial_ledger_mutation();
DROP TRIGGER IF EXISTS trg_pnl_ledger_immutable ON pnl_ledger;
CREATE TRIGGER trg_pnl_ledger_immutable BEFORE UPDATE OR DELETE ON pnl_ledger FOR EACH ROW EXECUTE FUNCTION reject_financial_ledger_mutation();
DROP TRIGGER IF EXISTS trg_audit_ledger_immutable ON audit_ledger;
CREATE TRIGGER trg_audit_ledger_immutable BEFORE UPDATE OR DELETE ON audit_ledger FOR EACH ROW EXECUTE FUNCTION reject_financial_ledger_mutation();

CREATE OR REPLACE FUNCTION compute_audit_event_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE hash_input text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('anbaybot_audit_ledger_chain'));
  SELECT event_hash INTO NEW.previous_hash FROM public.audit_ledger ORDER BY recorded_at DESC, id DESC LIMIT 1;
  hash_input := pg_catalog.concat_ws('|',
    coalesce(NEW.previous_hash,''), NEW.occurred_at::text, NEW.severity, NEW.event_type,
    NEW.actor_type, coalesce(NEW.actor_ref,''), coalesce(NEW.correlation_id::text,''),
    coalesce(NEW.request_id,''), NEW.source, coalesce(NEW.source_ref,''), NEW.sanitized_payload::text
  );
  NEW.event_hash := pg_catalog.encode(extensions.digest(hash_input,'sha256'),'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_ledger_hash ON audit_ledger;
CREATE TRIGGER trg_audit_ledger_hash BEFORE INSERT ON audit_ledger FOR EACH ROW EXECUTE FUNCTION compute_audit_event_hash();

REVOKE ALL ON FUNCTION reject_financial_ledger_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION compute_audit_event_hash() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION reject_financial_ledger_mutation() TO service_role;
GRANT EXECUTE ON FUNCTION compute_audit_event_hash() TO service_role;

COMMENT ON TABLE trade_ledger IS 'Append-only execution ledger. One row per lifecycle event; never overwrite a historical event.';
COMMENT ON TABLE pnl_ledger IS 'Append-only P&L ledger. LIVE, PAPER and TEST are strictly distinguishable.';
COMMENT ON TABLE audit_ledger IS 'Append-only chained audit ledger with SHA-256 event hashes; secrets must never be stored in sanitized_payload.';
