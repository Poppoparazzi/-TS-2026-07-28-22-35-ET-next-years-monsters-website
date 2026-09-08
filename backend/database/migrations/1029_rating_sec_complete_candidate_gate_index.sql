-- TS: 2026-09-08 11:08 ET

BEGIN;

-- Rating candidate selection begins from the full reserve but may only admit companies whose
-- SEC pipeline is complete. Keep that free preflight gate index-only and keyed by company_id so
-- PostgreSQL can discard unfinished SEC candidates before evaluating deeper revenue/liquidity
-- ranking or any paid Twelve Data history path.
CREATE INDEX IF NOT EXISTS company_pipeline_rating_sec_complete_candidate_idx
  ON company_pipeline_status (company_id)
  WHERE sec_status = 'complete';

COMMIT;
