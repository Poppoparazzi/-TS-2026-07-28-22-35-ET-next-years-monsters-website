-- TS: 2026-09-06 20:03 ET

BEGIN;

-- Candidate selection reuses recent machine-readable SEC-preflight failures from
-- data_refresh_runs.metadata across the 5,000-company reserve. Keep the recent
-- rating-run scan index-only when PostgreSQL visibility permits so the JSON array
-- expansion does not also require heap reads for every qualifying refresh run.
CREATE INDEX IF NOT EXISTS data_refresh_runs_recent_rating_started_cover_idx
  ON data_refresh_runs (started_at DESC)
  INCLUDE (metadata)
  WHERE refresh_type = 'ratings';

COMMIT;
