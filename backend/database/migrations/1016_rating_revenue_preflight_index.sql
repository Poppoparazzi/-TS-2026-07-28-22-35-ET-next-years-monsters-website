-- TS: 2026-09-06 21:05 ET

BEGIN;

-- Rating candidate selection repeatedly checks annual SEC revenue depth and the
-- newest annual revenue context across the 5,000-company reserve. Keep those
-- free SEC-preflight reads on a narrow partial index so paid market-history
-- capacity is reserved for candidates that survive the evidence gate.
CREATE INDEX IF NOT EXISTS company_facts_rating_revenue_preflight_idx
  ON company_facts (
    company_id,
    fiscal_year DESC NULLS LAST,
    period_end DESC NULLS LAST,
    filed_date DESC NULLS LAST
  )
  INCLUDE (value_numeric, retrieved_at)
  WHERE taxonomy = 'us-gaap'
    AND concept IN (
      'RevenueFromContractWithCustomerExcludingAssessedTax',
      'Revenues',
      'SalesRevenueNet'
    )
    AND value_numeric IS NOT NULL
    AND value_numeric >= 0
    AND fiscal_period = 'FY'
    AND form_type IN ('10-K','10-K/A','20-F','20-F/A','40-F','40-F/A');

COMMIT;
