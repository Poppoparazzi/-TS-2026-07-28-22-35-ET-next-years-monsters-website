-- TS: 2026-09-07 03:58 ET

BEGIN;

-- Candidate selection checks every reserve company for an already-completed
-- rating at the current engine version before any market-history work. Keep
-- that free exclusion lookup on a narrow partial index so the 5,000-company
-- reserve does not repeatedly scan historical/non-complete rating runs.
CREATE INDEX IF NOT EXISTS monster_rating_runs_completed_company_version_idx
  ON monster_rating_runs (company_id, rating_version)
  WHERE status = 'complete';

COMMIT;
