-- TS: 2026-08-05 08:11 ET

BEGIN;

CREATE TABLE IF NOT EXISTS market_daily_bars (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  bar_date date NOT NULL,
  open_price numeric(20, 6) NOT NULL CHECK (open_price > 0),
  high_price numeric(20, 6) NOT NULL CHECK (high_price > 0),
  low_price numeric(20, 6) NOT NULL CHECK (low_price > 0),
  close_price numeric(20, 6) NOT NULL CHECK (close_price > 0),
  volume bigint NOT NULL CHECK (volume >= 0),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  feed_disclosure text NOT NULL,
  CONSTRAINT market_daily_bar_range_check CHECK (
    high_price >= low_price AND
    high_price >= open_price AND
    high_price >= close_price AND
    low_price <= open_price AND
    low_price <= close_price
  ),
  CONSTRAINT market_daily_bar_unique UNIQUE (company_id, provider, bar_date)
);

CREATE INDEX IF NOT EXISTS market_daily_bars_company_date_idx
  ON market_daily_bars (company_id, bar_date DESC);

UPDATE monster_rating_runs
SET tier = 'Bronze'
WHERE tier = 'Watch';

UPDATE monster_rating_runs
SET tier = 'Cemetery Risk'
WHERE tier = 'Cemetery';

ALTER TABLE monster_rating_runs
  DROP CONSTRAINT IF EXISTS rating_tier_check;

ALTER TABLE monster_rating_runs
  ADD CONSTRAINT rating_tier_check CHECK (
    tier IN ('Platinum', 'Gold', 'Silver', 'Bronze', 'Goblin', 'Cemetery Risk')
  );

ALTER TABLE monster_rating_runs
  DROP CONSTRAINT IF EXISTS monster_rating_runs_score_check;

ALTER TABLE monster_rating_runs
  ADD CONSTRAINT monster_rating_runs_score_check CHECK (score >= 1 AND score <= 100);

ALTER TABLE monster_rating_runs
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS data_completeness_score numeric(5, 2),
  ADD COLUMN IF NOT EXISTS eligibility_code text NOT NULL DEFAULT 'eligible',
  ADD COLUMN IF NOT EXISTS positive_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS negative_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS result_payload jsonb,
  ADD COLUMN IF NOT EXISTS prior_rating_run_id bigint REFERENCES monster_rating_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS change_reasons jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE monster_rating_runs
  DROP CONSTRAINT IF EXISTS monster_rating_runs_confidence_check;

ALTER TABLE monster_rating_runs
  ADD CONSTRAINT monster_rating_runs_confidence_check CHECK (
    confidence IS NULL OR confidence IN ('high', 'medium', 'low')
  );

ALTER TABLE monster_rating_runs
  DROP CONSTRAINT IF EXISTS monster_rating_runs_completeness_check;

ALTER TABLE monster_rating_runs
  ADD CONSTRAINT monster_rating_runs_completeness_check CHECK (
    data_completeness_score IS NULL OR
    (data_completeness_score >= 0 AND data_completeness_score <= 100)
  );

CREATE TABLE IF NOT EXISTS rating_eligibility_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  engine_version varchar(40) NOT NULL,
  eligibility_code text NOT NULL,
  summary text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_completeness_score numeric(5, 2) NOT NULL CHECK (
    data_completeness_score >= 0 AND data_completeness_score <= 100
  ),
  data_as_of timestamptz,
  evaluated_at timestamptz NOT NULL,
  retry_after timestamptz,
  provider_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_eligibility_code_check CHECK (
    eligibility_code IN (
      'unresolved_sec_identity',
      'provider_not_connected',
      'unsupported_security_type',
      'insufficient_financial_history',
      'insufficient_market_history',
      'stale_market_data',
      'insufficient_liquidity',
      'incomplete_evidence'
    )
  ),
  CONSTRAINT rating_eligibility_result_unique UNIQUE (
    company_id,
    engine_version,
    evaluated_at
  )
);

CREATE INDEX IF NOT EXISTS rating_eligibility_company_time_idx
  ON rating_eligibility_results (company_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS rating_batch_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  engine_version varchar(40) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  requested_count integer NOT NULL DEFAULT 0 CHECK (requested_count >= 0),
  claimed_count integer NOT NULL DEFAULT 0 CHECK (claimed_count >= 0),
  rated_count integer NOT NULL DEFAULT 0 CHECK (rated_count >= 0),
  unrated_count integer NOT NULL DEFAULT 0 CHECK (unrated_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  concurrency integer NOT NULL CHECK (concurrency >= 1 AND concurrency <= 20),
  cancellation_requested boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  heartbeat_at timestamptz,
  failure_summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_batch_status_check CHECK (
    status IN ('pending', 'running', 'completed', 'partial', 'cancelled', 'failed')
  ),
  CONSTRAINT rating_batch_reconciliation_check CHECK (
    claimed_count <= requested_count AND
    rated_count + unrated_count + failed_count <= claimed_count
  )
);

CREATE INDEX IF NOT EXISTS rating_batch_runs_time_idx
  ON rating_batch_runs (created_at DESC);

CREATE TABLE IF NOT EXISTS rating_batch_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  batch_run_id bigint NOT NULL REFERENCES rating_batch_runs(id) ON DELETE CASCADE,
  company_id bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  rating_run_id bigint REFERENCES monster_rating_runs(id) ON DELETE SET NULL,
  eligibility_result_id bigint REFERENCES rating_eligibility_results(id) ON DELETE SET NULL,
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  last_error text,
  unresolved_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rating_batch_item_status_check CHECK (
    status IN ('pending', 'processing', 'rated', 'unrated', 'failed', 'cancelled')
  ),
  CONSTRAINT rating_batch_item_unique UNIQUE (batch_run_id, company_id)
);

CREATE INDEX IF NOT EXISTS rating_batch_items_claim_idx
  ON rating_batch_items (batch_run_id, status, next_retry_at, id);

CREATE TABLE IF NOT EXISTS provider_health_snapshots (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_type text NOT NULL,
  provider_name text NOT NULL,
  configured boolean NOT NULL,
  status text NOT NULL,
  checked_at timestamptz NOT NULL,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  failure_code text,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_health_type_check CHECK (
    provider_type IN ('sec', 'market-data', 'database', 'rating-engine')
  ),
  CONSTRAINT provider_health_status_check CHECK (
    status IN ('healthy', 'degraded', 'unconfigured', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS provider_health_latest_idx
  ON provider_health_snapshots (provider_type, provider_name, checked_at DESC);

CREATE OR REPLACE VIEW latest_rating_eligibility AS
SELECT DISTINCT ON (company_id)
  id,
  company_id,
  engine_version,
  eligibility_code,
  summary,
  reasons,
  data_completeness_score,
  data_as_of,
  evaluated_at,
  retry_after,
  provider_status,
  result_payload
FROM rating_eligibility_results
ORDER BY company_id, evaluated_at DESC, id DESC;

COMMIT;
