-- TS: 2026-08-21 15:16 UTC

BEGIN;

ALTER TABLE company_pipeline_status
  ADD COLUMN IF NOT EXISTS replacement_attempted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS company_pipeline_replacement_idx
  ON company_pipeline_status (replacement_attempted)
  WHERE replacement_attempted = true;

COMMIT;
