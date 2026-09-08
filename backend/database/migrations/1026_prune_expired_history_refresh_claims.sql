-- TS: 2026-09-08 03:00 ET

BEGIN;

-- Keep the cross-size paid-history coordination table small and authoritative. Expired
-- claims cannot block a refresh, but leaving them behind forces every later claim check
-- to scan dead coordination state. Prune only this symbol/provider while the same
-- advisory lock used by the cross-size guard is held.
CREATE OR REPLACE FUNCTION guard_benchmark_history_cross_size_refresh_claim()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(NEW.symbol), hashtext(NEW.provider));

  DELETE FROM benchmark_history_refresh_claims
  WHERE symbol = NEW.symbol
    AND provider = NEW.provider
    AND claimed_until <= now();

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

COMMIT;
