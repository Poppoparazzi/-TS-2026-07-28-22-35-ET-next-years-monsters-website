-- TS: 2026-09-07 09:14 ET

CREATE TABLE IF NOT EXISTS benchmark_history_cache (
  symbol text NOT NULL,
  provider text NOT NULL,
  output_size integer NOT NULL CHECK (output_size BETWEEN 60 AND 500),
  bars jsonb NOT NULL,
  retrieved_at timestamptz NOT NULL,
  feed_disclosure text NOT NULL,
  PRIMARY KEY (symbol, provider, output_size),
  CHECK (jsonb_typeof(bars) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_benchmark_history_cache_freshness
  ON benchmark_history_cache (symbol, provider, output_size, retrieved_at DESC);
