-- TS: 2026-09-08 11:59 ET

BEGIN;

-- Production rating candidates are purchased from Twelve Data. Keep the shared latest-history
-- view aligned with the provider used by the paid rating path so evidence from another provider
-- cannot suppress or preferentially rank a Twelve Data candidate.
DROP VIEW IF EXISTS market_history_evidence_latest;
CREATE VIEW market_history_evidence_latest AS
SELECT DISTINCT ON (mhe.company_id)
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
WHERE mhe.provider = 'twelve-data'
ORDER BY
  mhe.company_id,
  mhe.retrieved_at DESC,
  mhe.usable_bar_count DESC,
  mhe.latest_bar_date DESC NULLS LAST;

COMMIT;
