-- TS: 2026-09-08 01:13 ET

BEGIN;

-- Cross-size quota coordination checks every active refresh claim for the same
-- symbol/provider before any paid Twelve Data history request. Give that guard a
-- direct range path on claimed_until so the 5,000-company rollout does not make
-- PostgreSQL repeatedly walk exact-size primary-key entries to find live leases.
CREATE INDEX IF NOT EXISTS idx_benchmark_history_refresh_claim_active_lookup
ON benchmark_history_refresh_claims (symbol, provider, claimed_until DESC)
INCLUDE (output_size, claim_token);

COMMIT;
