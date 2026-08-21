-- TS: 2026-08-21 15:16 UTC

BEGIN;

-- One SEC issuer may have multiple publicly searchable share-class tickers.
-- Keep each ticker on its own recovery path while indexing the shared CIK.
ALTER TABLE companies
  DROP CONSTRAINT IF EXISTS companies_sec_cik_unique;

CREATE INDEX IF NOT EXISTS companies_sec_cik_idx
  ON companies (sec_cik)
  WHERE sec_cik IS NOT NULL;

-- The same issuer filing is valid evidence for each of its share-class tickers.
ALTER TABLE sec_filings
  DROP CONSTRAINT IF EXISTS sec_filings_accession_unique;

ALTER TABLE sec_filings
  ADD CONSTRAINT sec_filings_company_accession_unique
  UNIQUE (company_id, accession_number);

COMMIT;
