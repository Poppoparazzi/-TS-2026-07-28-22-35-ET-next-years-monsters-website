-- TS: 2026-07-29 16:13 ET

BEGIN;

CREATE VIEW company_live_readiness AS
WITH latest_quote AS (
  SELECT DISTINCT ON (company_id)
    company_id,
    id AS quote_snapshot_id,
    provider,
    freshness,
    provider_timestamp,
    retrieved_at
  FROM quote_snapshots
  ORDER BY company_id, provider_timestamp DESC, retrieved_at DESC
),
latest_filing AS (
  SELECT DISTINCT ON (company_id)
    company_id,
    id AS filing_id,
    form_type,
    filing_date,
    retrieved_at
  FROM sec_filings
  ORDER BY company_id, filing_date DESC, retrieved_at DESC
),
latest_rating AS (
  SELECT DISTINCT ON (company_id)
    company_id,
    id AS rating_run_id,
    rating_version,
    score,
    tier,
    status,
    calculated_at,
    data_as_of,
    evidence_count,
    source_count
  FROM monster_rating_runs
  ORDER BY company_id, calculated_at DESC, id DESC
)
SELECT
  c.id AS company_id,
  c.ticker,
  c.company_name,
  c.is_pilot,
  q.quote_snapshot_id,
  q.provider AS quote_provider,
  q.freshness AS quote_freshness,
  q.provider_timestamp AS quote_timestamp,
  q.retrieved_at AS quote_retrieved_at,
  f.filing_id,
  f.form_type AS latest_filing_form,
  f.filing_date AS latest_filing_date,
  f.retrieved_at AS filing_retrieved_at,
  r.rating_run_id,
  r.rating_version,
  r.score,
  r.tier,
  r.status AS rating_status,
  r.calculated_at AS rating_calculated_at,
  r.data_as_of AS rating_data_as_of,
  r.evidence_count,
  r.source_count,
  (q.quote_snapshot_id IS NOT NULL) AS has_verified_quote,
  (
    q.quote_snapshot_id IS NOT NULL
    AND q.freshness IN ('live', 'near-live', 'delayed', 'end-of-day')
  ) AS quote_is_usable,
  (f.filing_id IS NOT NULL) AS has_sec_status,
  (
    r.rating_run_id IS NOT NULL
    AND r.status = 'complete'
    AND r.rating_version IS NOT NULL
  ) AS has_saved_versioned_rating,
  (
    r.rating_run_id IS NOT NULL
    AND r.evidence_count > 0
    AND r.source_count > 0
  ) AS has_rating_evidence,
  (
    q.quote_snapshot_id IS NOT NULL
    AND q.freshness IN ('live', 'near-live', 'delayed', 'end-of-day')
    AND f.filing_id IS NOT NULL
    AND r.rating_run_id IS NOT NULL
    AND r.status = 'complete'
    AND r.rating_version IS NOT NULL
    AND r.evidence_count > 0
    AND r.source_count > 0
    AND r.data_as_of IS NOT NULL
  ) AS is_live_ready,
  GREATEST(
    q.retrieved_at,
    f.retrieved_at,
    r.calculated_at
  ) AS last_successful_update
FROM companies c
LEFT JOIN latest_quote q ON q.company_id = c.id
LEFT JOIN latest_filing f ON f.company_id = c.id
LEFT JOIN latest_rating r ON r.company_id = c.id
WHERE c.is_active = true;

CREATE VIEW pilot_live_gate AS
SELECT
  count(*) AS required_company_count,
  count(*) FILTER (WHERE is_live_ready) AS ready_company_count,
  count(*) FILTER (WHERE NOT is_live_ready) AS pending_company_count,
  bool_and(is_live_ready) AND count(*) = 15 AS pilot_is_live_ready,
  max(last_successful_update) AS last_successful_update,
  array_agg(ticker ORDER BY ticker) FILTER (WHERE NOT is_live_ready) AS pending_tickers
FROM company_live_readiness
WHERE is_pilot = true;

CREATE VIEW top_25_live_gate AS
WITH candidate_companies AS (
  SELECT *
  FROM company_live_readiness
  ORDER BY is_pilot DESC, score DESC NULLS LAST, ticker
  LIMIT 25
)
SELECT
  25 AS required_company_count,
  count(*) AS candidate_company_count,
  count(*) FILTER (WHERE is_live_ready) AS ready_company_count,
  GREATEST(25 - count(*), 0) AS companies_still_to_add,
  count(*) FILTER (WHERE NOT is_live_ready) AS companies_failing_checks,
  (
    count(*) = 25
    AND bool_and(is_live_ready)
  ) AS top_25_is_live_ready,
  max(last_successful_update) AS last_successful_update,
  array_agg(ticker ORDER BY ticker) FILTER (WHERE NOT is_live_ready) AS pending_tickers
FROM candidate_companies;

COMMIT;
