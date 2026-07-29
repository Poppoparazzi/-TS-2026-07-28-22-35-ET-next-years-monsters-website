-- TS: 2026-07-29 16:10 ET

BEGIN;

CREATE TABLE companies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticker varchar(15) NOT NULL,
  company_name text NOT NULL,
  exchange text,
  security_type text,
  sector text,
  industry text,
  currency char(3) NOT NULL DEFAULT 'USD',
  sec_cik varchar(10),
  is_active boolean NOT NULL DEFAULT true,
  is_pilot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_ticker_uppercase CHECK (ticker = upper(ticker)),
  CONSTRAINT companies_ticker_format CHECK (ticker ~ '^[A-Z0-9.-]{1,15}$'),
  CONSTRAINT companies_ticker_unique UNIQUE (ticker),
  CONSTRAINT companies_sec_cik_unique UNIQUE (sec_cik)
);

CREATE TABLE quote_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  price numeric(20, 6) NOT NULL CHECK (price >= 0),
  change_amount numeric(20, 6),
  percent_change numeric(12, 6),
  volume bigint CHECK (volume IS NULL OR volume >= 0),
  market_session text NOT NULL DEFAULT 'unknown',
  freshness text NOT NULL,
  provider_timestamp timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  feed_disclosure text NOT NULL,
  raw_reference text,
  CONSTRAINT quote_market_session_check CHECK (
    market_session IN ('pre-market', 'regular', 'after-hours', 'closed', 'unknown')
  ),
  CONSTRAINT quote_freshness_check CHECK (
    freshness IN ('live', 'near-live', 'delayed', 'end-of-day', 'stale', 'unavailable')
  ),
  CONSTRAINT quote_snapshot_unique UNIQUE (company_id, provider, provider_timestamp)
);

CREATE INDEX quote_snapshots_company_time_idx
  ON quote_snapshots (company_id, provider_timestamp DESC);

CREATE TABLE sec_filings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  accession_number varchar(32) NOT NULL,
  form_type varchar(20) NOT NULL,
  filing_date date NOT NULL,
  report_date date,
  accepted_at timestamptz,
  primary_document text,
  primary_document_url text NOT NULL,
  filing_index_url text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sec_filings_accession_unique UNIQUE (accession_number)
);

CREATE INDEX sec_filings_company_date_idx
  ON sec_filings (company_id, filing_date DESC, accepted_at DESC);

CREATE TABLE company_facts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  taxonomy text NOT NULL,
  concept text NOT NULL,
  label text,
  description text,
  unit text NOT NULL,
  value_numeric numeric,
  value_text text,
  period_start date,
  period_end date,
  fiscal_year integer,
  fiscal_period text,
  form_type varchar(20),
  filed_date date,
  accession_number varchar(32),
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_facts_has_value CHECK (
    value_numeric IS NOT NULL OR value_text IS NOT NULL
  ),
  CONSTRAINT company_fact_context_unique UNIQUE (
    company_id,
    taxonomy,
    concept,
    unit,
    period_start,
    period_end,
    fiscal_year,
    fiscal_period,
    form_type,
    accession_number
  )
);

CREATE INDEX company_facts_lookup_idx
  ON company_facts (company_id, concept, period_end DESC, filed_date DESC);

CREATE TABLE data_refresh_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  refresh_type text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  requested_count integer NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
  succeeded_count integer NOT NULL DEFAULT 0 CHECK (succeeded_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failure_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT refresh_type_check CHECK (
    refresh_type IN ('quotes', 'sec-filings', 'company-facts', 'ratings', 'leaderboard')
  ),
  CONSTRAINT refresh_status_check CHECK (
    status IN ('running', 'completed', 'partial', 'failed')
  )
);

CREATE TABLE monster_rating_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  refresh_run_id bigint REFERENCES data_refresh_runs(id) ON DELETE SET NULL,
  rating_version varchar(40) NOT NULL,
  score numeric(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  tier text NOT NULL,
  status text NOT NULL DEFAULT 'complete',
  calculated_at timestamptz NOT NULL,
  data_as_of timestamptz NOT NULL,
  quote_snapshot_id bigint REFERENCES quote_snapshots(id) ON DELETE SET NULL,
  summary text NOT NULL,
  risks text NOT NULL,
  evidence_count integer NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  source_count integer NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_tier_check CHECK (
    tier IN ('Platinum', 'Gold', 'Silver', 'Watch', 'Goblin', 'Cemetery')
  ),
  CONSTRAINT rating_status_check CHECK (
    status IN ('complete', 'partial', 'blocked', 'superseded')
  ),
  CONSTRAINT rating_run_unique UNIQUE (company_id, rating_version, calculated_at)
);

CREATE INDEX monster_rating_runs_company_time_idx
  ON monster_rating_runs (company_id, calculated_at DESC);

CREATE INDEX monster_rating_runs_score_idx
  ON monster_rating_runs (score DESC, calculated_at DESC)
  WHERE status = 'complete';

CREATE TABLE monster_rating_components (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rating_run_id bigint NOT NULL REFERENCES monster_rating_runs(id) ON DELETE CASCADE,
  component_key varchar(80) NOT NULL,
  component_label text NOT NULL,
  raw_value numeric,
  normalized_score numeric(7, 3),
  weight numeric(7, 4) NOT NULL CHECK (weight >= 0),
  weighted_score numeric(8, 3) NOT NULL,
  direction text NOT NULL DEFAULT 'neutral',
  explanation text NOT NULL,
  CONSTRAINT rating_component_direction_check CHECK (
    direction IN ('positive', 'negative', 'neutral', 'unavailable')
  ),
  CONSTRAINT rating_component_unique UNIQUE (rating_run_id, component_key)
);

CREATE TABLE monster_rating_sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rating_run_id bigint NOT NULL REFERENCES monster_rating_runs(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  source_timestamp timestamptz,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  supports_components text[] NOT NULL DEFAULT ARRAY[]::text[],
  notes text,
  CONSTRAINT rating_source_type_check CHECK (
    source_type IN ('market-data', 'sec-filing', 'company-fact', 'verified-news', 'derived')
  )
);

CREATE INDEX monster_rating_sources_run_idx
  ON monster_rating_sources (rating_run_id, source_type);

CREATE TABLE leaderboard_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  refresh_run_id bigint REFERENCES data_refresh_runs(id) ON DELETE SET NULL,
  leaderboard_version varchar(40) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  universe_size integer NOT NULL CHECK (universe_size > 0),
  eligible_count integer NOT NULL DEFAULT 0 CHECK (eligible_count >= 0),
  published_count integer NOT NULL DEFAULT 0 CHECK (published_count >= 0),
  data_as_of timestamptz,
  calculated_at timestamptz,
  published_at timestamptz,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leaderboard_status_check CHECK (
    status IN ('pending', 'calculating', 'verified', 'published', 'failed')
  ),
  CONSTRAINT leaderboard_counts_check CHECK (
    eligible_count <= universe_size AND published_count <= eligible_count
  )
);

CREATE INDEX leaderboard_runs_published_idx
  ON leaderboard_runs (published_at DESC)
  WHERE status = 'published';

CREATE TABLE leaderboard_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  leaderboard_run_id bigint NOT NULL REFERENCES leaderboard_runs(id) ON DELETE CASCADE,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rating_run_id bigint NOT NULL REFERENCES monster_rating_runs(id) ON DELETE RESTRICT,
  rank integer NOT NULL CHECK (rank > 0),
  score numeric(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  prior_rank integer CHECK (prior_rank IS NULL OR prior_rank > 0),
  rank_change integer,
  is_rising_star boolean NOT NULL DEFAULT false,
  freshness_status text NOT NULL,
  CONSTRAINT leaderboard_entry_rank_unique UNIQUE (leaderboard_run_id, rank),
  CONSTRAINT leaderboard_entry_company_unique UNIQUE (leaderboard_run_id, company_id),
  CONSTRAINT leaderboard_freshness_check CHECK (
    freshness_status IN ('current', 'aging', 'stale', 'blocked')
  )
);

CREATE INDEX leaderboard_entries_company_idx
  ON leaderboard_entries (company_id, leaderboard_run_id DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER companies_set_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE VIEW latest_company_quotes AS
SELECT DISTINCT ON (company_id)
  id,
  company_id,
  provider,
  price,
  change_amount,
  percent_change,
  volume,
  market_session,
  freshness,
  provider_timestamp,
  retrieved_at,
  feed_disclosure
FROM quote_snapshots
ORDER BY company_id, provider_timestamp DESC, retrieved_at DESC;

CREATE VIEW latest_monster_ratings AS
SELECT DISTINCT ON (company_id)
  id,
  company_id,
  rating_version,
  score,
  tier,
  status,
  calculated_at,
  data_as_of,
  summary,
  risks,
  evidence_count,
  source_count
FROM monster_rating_runs
WHERE status = 'complete'
ORDER BY company_id, calculated_at DESC, id DESC;

CREATE VIEW latest_published_leaderboard AS
SELECT
  lr.id AS leaderboard_run_id,
  lr.leaderboard_version,
  lr.data_as_of,
  lr.calculated_at,
  lr.published_at,
  le.rank,
  le.prior_rank,
  le.rank_change,
  le.is_rising_star,
  le.freshness_status,
  c.ticker,
  c.company_name,
  c.sector,
  le.score,
  mrr.tier,
  mrr.rating_version,
  mrr.calculated_at AS rating_calculated_at
FROM leaderboard_runs lr
JOIN leaderboard_entries le ON le.leaderboard_run_id = lr.id
JOIN companies c ON c.id = le.company_id
JOIN monster_rating_runs mrr ON mrr.id = le.rating_run_id
WHERE lr.id = (
  SELECT id
  FROM leaderboard_runs
  WHERE status = 'published'
  ORDER BY published_at DESC, id DESC
  LIMIT 1
)
ORDER BY le.rank;

COMMIT;
