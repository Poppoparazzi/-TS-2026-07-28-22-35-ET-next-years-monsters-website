-- TS: 2026-09-05 06:00 ET

BEGIN;

CREATE OR REPLACE FUNCTION enforce_quote_snapshot_timestamp_sanity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider_timestamp > NEW.retrieved_at + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22007',
      MESSAGE = 'quote_snapshot_future_provider_timestamp';
  END IF;

  IF NEW.retrieved_at > clock_timestamp() + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22007',
      MESSAGE = 'quote_snapshot_future_retrieved_at';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_snapshot_timestamp_sanity ON quote_snapshots;

CREATE TRIGGER quote_snapshot_timestamp_sanity
BEFORE INSERT OR UPDATE OF provider_timestamp, retrieved_at
ON quote_snapshots
FOR EACH ROW
EXECUTE FUNCTION enforce_quote_snapshot_timestamp_sanity();

COMMIT;
