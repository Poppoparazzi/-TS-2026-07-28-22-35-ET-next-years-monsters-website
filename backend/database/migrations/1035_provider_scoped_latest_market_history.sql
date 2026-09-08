-- TS: 2026-09-08 18:09 ET

BEGIN;

-- Canonical latest market-history evidence keyed by both company and provider. This keeps
-- candidate ranking/suppression ready for the active paid provider without allowing evidence
-- from a different feed to leak into a provider-specific rating decision.
CREATE OR REPLACE VIEW market_history_evidence_latest_by_provider AS
SELECT DISTINCT ON (mhe.company_id, mhe.provider)
  mhe.company_id,
  mhe.provider,
  mhe.usable_bar_count,
  mhe.latest_bar_date,
  mhe.twenty_session_average_dollar_volume,
  mhe.retrieved_at,
  mhe.feed_disclosure,
  mhe.rating_eligibility_code,
  mhe.suppression_reason,
  (mhe.usable_bar_count >= 253) AS rating_history_ready
FROM market_history_evidence mhe
ORDER BY
  mhe.company_id,
  mhe.provider,
  mhe.retrieved_at DESC,
  mhe.usable_bar_count DESC,
  mhe.latest_bar_date DESC NULLS LAST;

COMMIT;
