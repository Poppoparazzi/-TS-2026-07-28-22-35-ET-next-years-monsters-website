-- TS: 2026-07-29 16:12 ET

BEGIN;

INSERT INTO companies (
  ticker,
  company_name,
  exchange,
  security_type,
  sector,
  currency,
  is_active,
  is_pilot
)
VALUES
  ('AAPL', 'Apple Inc.', 'NASDAQ', 'Common Stock', 'Technology', 'USD', true, true),
  ('NVDA', 'NVIDIA Corporation', 'NASDAQ', 'Common Stock', 'Semiconductors', 'USD', true, true),
  ('MNST', 'Monster Beverage Corporation', 'NASDAQ', 'Common Stock', 'Consumer Staples', 'USD', true, true),
  ('AMZN', 'Amazon.com, Inc.', 'NASDAQ', 'Common Stock', 'Consumer / Cloud', 'USD', true, true),
  ('TSLA', 'Tesla, Inc.', 'NASDAQ', 'Common Stock', 'Automotive / Technology', 'USD', true, true),
  ('NFLX', 'Netflix, Inc.', 'NASDAQ', 'Common Stock', 'Media', 'USD', true, true),
  ('AMD', 'Advanced Micro Devices, Inc.', 'NASDAQ', 'Common Stock', 'Semiconductors', 'USD', true, true),
  ('COST', 'Costco Wholesale Corporation', 'NASDAQ', 'Common Stock', 'Retail', 'USD', true, true),
  ('VRT', 'Vertiv Holdings Co', 'NYSE', 'Common Stock', 'Industrial Technology', 'USD', true, true),
  ('AXON', 'Axon Enterprise, Inc.', 'NASDAQ', 'Common Stock', 'Public Safety Technology', 'USD', true, true),
  ('DECK', 'Deckers Outdoor Corporation', 'NYSE', 'Common Stock', 'Consumer Discretionary', 'USD', true, true),
  ('WING', 'Wingstop Inc.', 'NASDAQ', 'Common Stock', 'Restaurants', 'USD', true, true),
  ('META', 'Meta Platforms, Inc.', 'NASDAQ', 'Common Stock', 'Technology / Advertising', 'USD', true, true),
  ('APP', 'AppLovin Corporation', 'NASDAQ', 'Common Stock', 'Advertising Technology', 'USD', true, true),
  ('MSFT', 'Microsoft Corporation', 'NASDAQ', 'Common Stock', 'Technology', 'USD', true, true)
ON CONFLICT (ticker) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  exchange = EXCLUDED.exchange,
  security_type = EXCLUDED.security_type,
  sector = EXCLUDED.sector,
  currency = EXCLUDED.currency,
  is_active = EXCLUDED.is_active,
  is_pilot = EXCLUDED.is_pilot,
  updated_at = now();

COMMIT;
