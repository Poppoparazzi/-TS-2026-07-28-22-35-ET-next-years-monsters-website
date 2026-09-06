-- TS: 2026-09-06 18:57 ET

BEGIN;

-- Rating candidate selection checks recent machine-readable SEC preflight failures for
-- every reserve candidate. Keep that lookup bounded to recent rating runs instead of
-- repeatedly scanning unrelated refresh history across the 5,000-company reserve.
CREATE INDEX IF NOT EXISTS data_refresh_runs_recent_rating_started_idx
  ON data_refresh_runs (started_at DESC)
  WHERE refresh_type = 'ratings';

COMMIT;
