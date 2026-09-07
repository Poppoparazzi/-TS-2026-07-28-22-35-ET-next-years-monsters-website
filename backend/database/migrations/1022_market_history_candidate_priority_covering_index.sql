-- TS: 2026-09-07 12:02 ET

BEGIN;

-- Candidate selection repeatedly joins the latest provider-backed market-history evidence across
-- the full reserve. Put retrieved_at into the index order used by the latest-evidence view and
-- cover the readiness/liquidity/suppression fields consumed by quota-safe candidate ranking.
CREATE INDEX IF NOT EXISTS market_history_evidence_candidate_priority_idx
  ON market_history_evidence (
    company_id,
    retrieved_at DESC,
    usable_bar_count DESC,
    latest_bar_date DESC
  )
  INCLUDE (
    twenty_session_average_dollar_volume,
    rating_eligibility_code,
    suppression_reason,
    provider
  );

COMMIT;
