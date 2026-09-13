-- TS: 2026-09-13 12:02 UTC

BEGIN;

ALTER TABLE market_history_request_claims
  ADD COLUMN IF NOT EXISTS hold_reason TEXT;

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
  should_hold BOOLEAN := FALSE;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM market_history_evidence_latest_by_provider mhe
    WHERE mhe.company_id = p_company_id
      AND mhe.provider = p_provider
      AND mhe.rating_history_ready = TRUE
      AND mhe.suppression_reason IS NULL
      AND mhe.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM monster_rating_runs mrr
    WHERE mrr.company_id = p_company_id
      AND mrr.rating_version = p_rating_version
      AND mrr.status = 'complete'
  )
  INTO should_hold;

  IF should_hold THEN
    UPDATE market_history_request_claims
    SET expires_at = GREATEST(expires_at, CURRENT_TIMESTAMP + INTERVAL '1 hour'),
        hold_reason = 'completed_rating_persistence_pending'
    WHERE company_id = p_company_id
      AND provider = p_provider
      AND rating_version = p_rating_version
      AND run_id IS NOT DISTINCT FROM p_run_id;

    RETURN FALSE;
  END IF;

  DELETE FROM market_history_request_claims
  WHERE company_id = p_company_id
    AND provider = p_provider
    AND rating_version = p_rating_version
    AND run_id IS NOT DISTINCT FROM p_run_id;

  released := FOUND;
  RETURN released;
END;
$$;

COMMENT ON COLUMN market_history_request_claims.hold_reason IS
  'Machine-readable reason an otherwise releasable paid-history lease is retained. completed_rating_persistence_pending prevents immediate provider re-spend when ready history exists but no durable completed rating exists yet.';

COMMIT;
