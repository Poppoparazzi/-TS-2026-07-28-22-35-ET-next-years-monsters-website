-- TS: 2026-09-05 21:01 ET

-- Allow the current owner to renew an unexpired market-history request claim while
-- preserving the existing rule that another worker may take over only after expiry.
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
    claimed_at = CASE
      WHEN market_history_request_claims.run_id IS NOT DISTINCT FROM EXCLUDED.run_id
        THEN market_history_request_claims.claimed_at
      ELSE EXCLUDED.claimed_at
    END,
    expires_at = EXCLUDED.expires_at
  WHERE market_history_request_claims.expires_at <= CURRENT_TIMESTAMP
     OR market_history_request_claims.run_id IS NOT DISTINCT FROM EXCLUDED.run_id;

  RETURN FOUND;
END;
$$;
