-- TS: 2026-08-02 17:08 ET

BEGIN;

ALTER TABLE company_pipeline_status
  DROP CONSTRAINT company_pipeline_sec_status_check;

ALTER TABLE company_pipeline_status
  ADD CONSTRAINT company_pipeline_sec_status_check CHECK (
    sec_status IN (
      'queued',
      'processing',
      'complete',
      'partial',
      'failed',
      'stale',
      'unresolved'
    )
  );

COMMIT;
