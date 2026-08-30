-- TS: 2026-08-30 07:58 ET

BEGIN;

ALTER TABLE market_history_evidence
  ADD COLUMN IF NOT EXISTS rating_eligibility_code text,
  ADD COLUMN IF NOT EXISTS suppression_reason text;

CREATE INDEX IF NOT EXISTS market_history_evidence_suppression_idx
  ON market_history_evidence (suppression_reason, retrieved_at DESC)
  WHERE suppression_reason IS NOT NULL;

COMMIT;
