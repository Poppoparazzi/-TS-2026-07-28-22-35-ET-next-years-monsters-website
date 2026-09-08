-- TS: 2026-09-08 16:58 ET

BEGIN;

-- Full-reserve candidate selection rejects recent machine-coded replaceable failures before
-- any paid market-history request. Index the exact ratings-only JSONB slice so the free preflight
-- can find prior ticker failures without repeatedly scanning the refresh-run ledger.
CREATE INDEX IF NOT EXISTS data_refresh_runs_ratings_replaceable_gin_idx
  ON data_refresh_runs
  USING GIN ((metadata -> 'replaceable') jsonb_path_ops)
  WHERE refresh_type = 'ratings';

COMMIT;
