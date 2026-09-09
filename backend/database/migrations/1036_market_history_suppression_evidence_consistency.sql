-- TS: 2026-09-08 21:08 ET

BEGIN;

-- Durable suppression is only useful when the stored machine reason is backed by the evidence
-- that actually makes the candidate ineligible. Enforce those evidence thresholds for all new
-- and updated rows while leaving legacy rows available for later reconciliation. This prevents a
-- malformed suppression from either wasting a future paid history call or incorrectly blocking a
-- candidate that should be reconsidered.
ALTER TABLE market_history_evidence
  ADD CONSTRAINT market_history_evidence_suppression_evidence_consistency
  CHECK (
    suppression_reason IS NULL
    OR (
      suppression_reason = 'insufficient_market_history'
      AND usable_bar_count < 253
    )
    OR (
      suppression_reason = 'insufficient_liquidity'
      AND usable_bar_count >= 253
      AND twenty_session_average_dollar_volume IS NOT NULL
      AND twenty_session_average_dollar_volume < 1000000
    )
    OR (
      suppression_reason = 'stale_market_data'
      AND usable_bar_count >= 253
      AND latest_bar_date IS NOT NULL
    )
  ) NOT VALID;

COMMIT;
