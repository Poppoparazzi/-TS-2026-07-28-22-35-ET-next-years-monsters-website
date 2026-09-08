-- TS: 2026-09-08 06:01 ET

BEGIN;

-- When a larger, equally-fresh-or-newer paid history snapshot is persisted, it can satisfy
-- every smaller request for the same symbol/provider. Remove only older/equal smaller rows
-- that are fully dominated by the new snapshot. This keeps the quota-safe cache canonical
-- and prevents later lookups from carrying redundant paid-history evidence indefinitely.
CREATE OR REPLACE FUNCTION prune_dominated_benchmark_history_cache_rows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM benchmark_history_cache
  WHERE symbol = NEW.symbol
    AND provider = NEW.provider
    AND output_size < NEW.output_size
    AND retrieved_at <= NEW.retrieved_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS benchmark_history_cache_prune_dominated_rows
  ON benchmark_history_cache;

CREATE TRIGGER benchmark_history_cache_prune_dominated_rows
AFTER INSERT OR UPDATE OF bars, retrieved_at, feed_disclosure
ON benchmark_history_cache
FOR EACH ROW
EXECUTE FUNCTION prune_dominated_benchmark_history_cache_rows();

COMMIT;
