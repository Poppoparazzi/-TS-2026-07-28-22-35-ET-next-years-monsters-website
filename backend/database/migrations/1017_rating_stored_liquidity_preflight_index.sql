-- TS: 2026-09-06 22:01 ET

BEGIN;

-- Rating candidate selection checks the newest usable stored quote for each
-- company before spending Twelve Data history quota. Keep that free liquidity
-- preflight on a narrow, covering partial index across the 5,000-company reserve.
CREATE INDEX IF NOT EXISTS quote_snapshots_rating_liquidity_preflight_idx
  ON quote_snapshots (
    company_id,
    provider_timestamp DESC,
    retrieved_at DESC
  )
  INCLUDE (price, volume)
  WHERE price > 0
    AND volume > 0;

COMMIT;
