-- TS: 2026-08-28 07:08 ET

BEGIN;

CREATE TABLE IF NOT EXISTS market_history_evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  usable_bar_count integer NOT NULL CHECK (usable_bar_count >= 0),
  latest_bar_date date,
  retrieved_at timestamptz NOT NULL,
  feed_disclosure text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_history_evidence_company_provider_unique UNIQUE (company_id, provider)
);

CREATE INDEX IF NOT EXISTS market_history_evidence_company_count_idx
  ON market_history_evidence (company_id, usable_bar_count DESC, latest_bar_date DESC);

COMMIT;
