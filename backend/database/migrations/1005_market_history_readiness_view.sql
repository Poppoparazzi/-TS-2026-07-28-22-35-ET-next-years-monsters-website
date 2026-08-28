-- TS: 2026-08-28 10:01 ET

BEGIN;

CREATE OR REPLACE VIEW market_history_evidence_latest AS
SELECT DISTINCT ON (mhe.company_id)
  mhe.company_id,
  mhe.provider,
  mhe.usable_bar_count,
  mhe.latest_bar_date,
  mhe.retrieved_at,
  mhe.feed_disclosure,
  (mhe.usable_bar_count >= 253) AS rating_history_ready
FROM market_history_evidence mhe
ORDER BY
  mhe.company_id,
  mhe.retrieved_at DESC,
  mhe.usable_bar_count DESC,
  mhe.latest_bar_date DESC NULLS LAST;

COMMIT;
