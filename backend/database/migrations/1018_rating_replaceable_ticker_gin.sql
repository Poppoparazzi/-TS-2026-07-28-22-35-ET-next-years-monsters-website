-- TS: 2026-09-06 23:59 ET

CREATE INDEX IF NOT EXISTS idx_data_refresh_runs_ratings_replaceable_gin
ON data_refresh_runs
USING gin ((metadata -> 'replaceable') jsonb_path_ops)
WHERE refresh_type = 'ratings';
