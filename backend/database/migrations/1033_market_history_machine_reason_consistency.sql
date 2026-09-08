-- TS: 2026-09-08 16:08 ET

BEGIN;

-- Keep newly written market-history eligibility evidence machine-readable and internally
-- consistent. NOT VALID preserves legacy rows introduced before the reason columns existed,
-- while PostgreSQL still enforces the constraint for every new or updated row. That prevents a
-- malformed eligible/suppressed pair from defeating the durable quota guard before a paid
-- market-history request.
ALTER TABLE market_history_evidence
  ADD CONSTRAINT market_history_evidence_machine_reason_consistency
  CHECK (
    (
      rating_eligibility_code = 'eligible'
      AND suppression_reason IS NULL
    )
    OR (
      rating_eligibility_code IN (
        'insufficient_market_history',
        'insufficient_liquidity',
        'stale_market_data'
      )
      AND suppression_reason = rating_eligibility_code
    )
  ) NOT VALID;

COMMIT;
