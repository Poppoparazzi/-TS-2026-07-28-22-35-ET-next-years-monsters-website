-- TS: 2026-09-05 17:02 ET

CREATE TABLE IF NOT EXISTS market_history_request_claims (
  company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  rating_version TEXT NOT NULL,
  run_id BIGINT REFERENCES data_refresh_runs(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (company_id, provider, rating_version),
  CONSTRAINT market_history_request_claims_valid_window CHECK (expires_at > claimed_at)
);

CREATE INDEX IF NOT EXISTS idx_market_history_request_claims_expires_at
  ON market_history_request_claims (expires_at);

CREATE OR REPLACE FUNCTION try_claim_market_history_request(
  p_company_id BIGINT,
  p_provider TEXT,
  p_rating_version TEXT,
  p_run_id BIGINT,
  p_lease_seconds INTEGER DEFAULT 900
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  bounded_lease_seconds INTEGER := GREATEST(60, LEAST(COALESCE(p_lease_seconds, 900), 3600));
BEGIN
  INSERT INTO market_history_request_claims (
    company_id,
    provider,
    rating_version,
    run_id,
    claimed_at,
    expires_at
  ) VALUES (
    p_company_id,
    p_provider,
    p_rating_version,
    p_run_id,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + make_interval(secs => bounded_lease_seconds)
  )
  ON CONFLICT (company_id, provider, rating_version)
  DO UPDATE SET
    run_id = EXCLUDED.run_id,
    claimed_at = EXCLUDED.claimed_at,
    expires_at = EXCLUDED.expires_at
  WHERE market_history_request_claims.expires_at <= CURRENT_TIMESTAMP;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION release_market_history_request_claim(
  p_company_id BIGINT,
  p_provider TEXT,
  p_rating_version TEXT,
  p_run_id BIGINT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  released BOOLEAN := FALSE;
BEGIN
  DELETE FROM market_history_request_claims
  WHERE company_id = p_company_id
    AND provider = p_provider
    AND rating_version = p_rating_version
    AND run_id IS NOT DISTINCT FROM p_run_id;

  released := FOUND;
  RETURN released;
END;
$$;
