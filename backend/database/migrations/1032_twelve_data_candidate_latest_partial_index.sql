-- TS: 2026-09-08 15:08 ET

BEGIN;

-- The production rating candidate view is deliberately scoped to Twelve Data.
-- Keep its DISTINCT ON (company_id) latest-evidence lookup on a compact partial
-- covering index so the free history/liquidity/suppression preflight remains
-- cheap across the full 5,000-company reserve before any paid history request.
CREATE INDEX IF NOT EXISTS market_history_evidence_twelve_data_candidate_latest_idx
  ON market_history_evidence (
    company_id,
    retrieved_at DESC,
    usable_bar_count DESC,
    latest_bar_date DESC
  )
  INCLUDE (
    twenty_session_average_dollar_volume,
    rating_eligibility_code,
    suppression_reason
  )
  WHERE provider = 'twelve-data';

COMMIT;
