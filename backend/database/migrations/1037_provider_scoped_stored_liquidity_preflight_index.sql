-- TS: 2026-09-09 03:59 ET

BEGIN;

-- Candidate selection now scopes stored quote evidence to the active market
-- provider before paid history work. Match that lookup so the free preflight
-- does not scan irrelevant providers across the 5,000-company reserve.
CREATE INDEX IF NOT EXISTS quote_snapshots_rating_provider_liquidity_preflight_idx
  ON quote_snapshots (
    company_id,
    provider,
    provider_timestamp DESC,
    retrieved_at DESC
  )
  INCLUDE (price, volume)
  WHERE price > 0
    AND volume > 0;

COMMIT;
