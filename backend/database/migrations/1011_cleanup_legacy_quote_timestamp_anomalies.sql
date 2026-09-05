-- TS: 2026-09-05 11:57 ET

BEGIN;

-- Remove legacy quote rows that could not have passed the current timestamp-sanity
-- trigger. Do not rewrite provider timestamps because that would fabricate source data.
DELETE FROM quote_snapshots
WHERE provider_timestamp > retrieved_at + INTERVAL '5 minutes'
   OR retrieved_at > clock_timestamp() + INTERVAL '5 minutes';

COMMIT;
