-- TS: 2026-09-08 08:05 ET

BEGIN;

-- Rating batches recheck durable market-history suppression repeatedly before any paid history
-- request. The unique (company_id, provider) key finds the row, but the suppression read still
-- needs eligibility/reason/count/freshness columns. Cover that exact quota-guard lookup so the
-- 5,000-company rollout can answer known-ineligible checks from the index when PostgreSQL permits
-- an index-only scan, without changing suppression semantics or provider evidence.
CREATE INDEX IF NOT EXISTS market_history_evidence_suppression_lookup_idx
  ON market_history_evidence (company_id, provider)
  INCLUDE (
    rating_eligibility_code,
    suppression_reason,
    usable_bar_count,
    retrieved_at
  );

COMMIT;
