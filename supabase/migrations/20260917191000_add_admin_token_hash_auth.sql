/* ANBAYBOT personal admin access: store hashes only, never plaintext tokens. */
CREATE TABLE IF NOT EXISTS admin_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT 'personal',
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE admin_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON admin_tokens TO service_role;

CREATE INDEX IF NOT EXISTS idx_admin_tokens_active ON admin_tokens(active) WHERE active = true;
COMMENT ON TABLE admin_tokens IS 'ANBAYBOT personal admin token hashes only. Plaintext tokens must remain outside the database.';
