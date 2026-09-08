-- TS: 2026-09-07 20:59 ET

BEGIN;

-- Candidate selection checks data_refresh_runs.metadata -> 'replaceable' with JSONB containment
-- before spending paid market-history quota. The existing covering B-tree keeps the recent-run
-- scan cheap; this expression GIN lets PostgreSQL accelerate the per-ticker containment test
-- across the full 5,000-company reserve instead of repeatedly walking every failure array.
CREATE INDEX IF NOT EXISTS data_refresh_runs_rating_replaceable_metadata_gin_idx
  ON data_refresh_runs
  USING gin ((metadata -> 'replaceable') jsonb_path_ops)
  WHERE refresh_type = 'ratings';

COMMIT;
