-- TS: 2026-09-05 07:02 ET

BEGIN;

-- Legacy rows created before the application-level timestamp guard can contain a
-- latest bar date after the provider retrieval date. Do not fabricate a corrected
-- trading date: clear the invalid date so it cannot be treated as fresh evidence
-- or create an impossible session-gap suppression.
UPDATE market_history_evidence
SET latest_bar_date = NULL
WHERE latest_bar_date IS NOT NULL
  AND latest_bar_date > retrieved_at::date;

CREATE OR REPLACE FUNCTION reject_future_market_history_evidence()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latest_bar_date IS NOT NULL
     AND NEW.latest_bar_date > NEW.retrieved_at::date THEN
    RAISE EXCEPTION 'market_history_evidence_future_latest_bar_date'
      USING ERRCODE = '22007';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS market_history_evidence_timestamp_sanity
  ON market_history_evidence;

CREATE TRIGGER market_history_evidence_timestamp_sanity
BEFORE INSERT OR UPDATE OF latest_bar_date, retrieved_at
ON market_history_evidence
FOR EACH ROW
EXECUTE FUNCTION reject_future_market_history_evidence();

COMMIT;
