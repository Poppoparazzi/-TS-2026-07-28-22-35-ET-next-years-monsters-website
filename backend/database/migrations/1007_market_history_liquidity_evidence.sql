-- TS: 2026-09-04 09:00 ET

BEGIN;

ALTER TABLE market_history_evidence
  ADD COLUMN IF NOT EXISTS twenty_session_average_dollar_volume numeric;

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
  (mhe.usable_bar_count >= 253) AS rating_history_ready
FROM market_history_evidence mhe
ORDER BY
  mhe.company_id,
  mhe.retrieved_at DESC,
  mhe.usable_bar_count DESC,
  mhe.latest_bar_date DESC NULLS LAST;

COMMIT;
