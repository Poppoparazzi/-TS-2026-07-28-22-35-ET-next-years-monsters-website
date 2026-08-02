-- TS: 2026-08-02 14:50 ET

BEGIN;

CREATE TABLE company_pipeline_status (
  company_id bigint PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  sec_status text NOT NULL DEFAULT 'queued',
  quote_status text NOT NULL DEFAULT 'queued',
  rating_status text NOT NULL DEFAULT 'queued',
  sec_attempt_count integer NOT NULL DEFAULT 0 CHECK (sec_attempt_count >= 0),
  last_error text,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_pipeline_sec_status_check CHECK (
    sec_status IN ('queued', 'processing', 'complete', 'partial', 'failed', 'stale')
  ),
  CONSTRAINT company_pipeline_quote_status_check CHECK (
    quote_status IN ('queued', 'processing', 'complete', 'failed', 'unconfigured', 'stale')
  ),
  CONSTRAINT company_pipeline_rating_status_check CHECK (
    rating_status IN ('queued', 'processing', 'complete', 'partial', 'blocked', 'failed', 'stale')
  )
);

CREATE INDEX company_pipeline_sec_queue_idx
  ON company_pipeline_status (sec_status, next_retry_at, updated_at);

CREATE TRIGGER company_pipeline_status_set_updated_at
BEFORE UPDATE ON company_pipeline_status
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO company_pipeline_status (
  company_id,
  sec_status,
  quote_status,
  rating_status,
  last_completed_at
)
SELECT
  c.id,
  CASE
    WHEN EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id)
      AND EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id)
      THEN 'complete'
    WHEN EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id)
      OR EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id)
      THEN 'partial'
    ELSE 'queued'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM quote_snapshots qs WHERE qs.company_id = c.id)
      THEN 'complete'
    ELSE 'unconfigured'
  END,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM monster_rating_runs mr
      WHERE mr.company_id = c.id AND mr.status = 'complete'
    ) THEN 'complete'
    ELSE 'blocked'
  END,
  CASE
    WHEN EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id)
      OR EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id)
      THEN c.updated_at
    ELSE NULL
  END
FROM companies c
ON CONFLICT (company_id) DO NOTHING;

COMMIT;
