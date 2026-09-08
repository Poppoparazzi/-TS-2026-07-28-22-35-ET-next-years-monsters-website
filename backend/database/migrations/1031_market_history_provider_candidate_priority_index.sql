-- TS: 2026-09-08 13:02 ET

BEGIN;

-- Candidate selection filters market-history evidence by the active paid provider before ranking
-- the full reserve. Existing indexes lead with company_id; put provider first so the current
-- Twelve Data slice, and a future provider-specific candidate query, can avoid scanning evidence
-- belonging to other providers while still covering readiness, liquidity, and suppression fields.
CREATE INDEX IF NOT EXISTS market_history_evidence_provider_candidate_priority_idx
  ON market_history_evidence (
    provider,
    company_id,
    retrieved_at DESC,
    usable_bar_count DESC,
    latest_bar_date DESC
  )
  INCLUDE (
    twenty_session_average_dollar_volume,
    rating_eligibility_code,
    suppression_reason
  );

COMMIT;
