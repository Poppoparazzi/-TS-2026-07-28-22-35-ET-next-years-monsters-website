-- TS: 2026-09-07 11:02 ET

CREATE TABLE IF NOT EXISTS benchmark_history_refresh_claims (
  symbol text NOT NULL,
  provider text NOT NULL,
  output_size integer NOT NULL CHECK (output_size BETWEEN 60 AND 500),
  claim_token text NOT NULL,
  claimed_until timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (symbol, provider, output_size)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_history_refresh_claims_expiry
  ON benchmark_history_refresh_claims (claimed_until);
