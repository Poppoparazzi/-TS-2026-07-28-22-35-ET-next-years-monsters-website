-- TS: 2026-09-08 00:01 ET

BEGIN;

-- A symbol/provider refresh is one paid Twelve Data operation even when callers request
-- different output sizes. Serialize lease inserts across output sizes so a 260-bar and
-- 500-bar request cannot both acquire independent paid-refresh leases at the same time.
CREATE OR REPLACE FUNCTION guard_benchmark_history_cross_size_refresh_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.symbol), hashtext(NEW.provider));

  IF EXISTS (
    SELECT 1
    FROM benchmark_history_refresh_claims AS existing
    WHERE existing.symbol = NEW.symbol
      AND existing.provider = NEW.provider
      AND existing.output_size <> NEW.output_size
      AND existing.claimed_until > now()
  ) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS benchmark_history_cross_size_refresh_claim_guard
  ON benchmark_history_refresh_claims;

CREATE TRIGGER benchmark_history_cross_size_refresh_claim_guard
BEFORE INSERT ON benchmark_history_refresh_claims
FOR EACH ROW
EXECUTE FUNCTION guard_benchmark_history_cross_size_refresh_claim();

COMMIT;
