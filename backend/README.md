# Next Year’s Monsters™ API

<!-- TS: 2026-08-01 21:52 ET -->

This folder contains the provider-neutral TypeScript backend for the live-data phase of Monster Check™.

## Current status

Implemented:

- Fastify TypeScript service scaffold.
- `GET /api/health`.
- `GET /api/provider-status`.
- `GET /api/readiness`.
- `GET /api/stored/AAPL` for read-only proof of persisted company data.
- `GET /api/tickers?q=apple`.
- `GET /api/quotes/AAPL`.
- `GET /api/quotes?symbols=AAPL,NVDA,MSFT` (up to 25 unique symbols).
- `GET /api/sec/company/AAPL`.
- `GET /api/sec/filings/AAPL?limit=10`.
- `GET /api/sec/facts/AAPL`.
- Secure environment-variable configuration.
- Provider-neutral market-data and SEC-data contracts.
- Twelve Data quote and symbol-search adapter.
- Provider-neutral quote cache, concurrent batch loading, request deduplication, and per-symbol failure containment.
- Official SEC ticker mapping, submissions, filing links, and selected XBRL company-facts adapter.
- PostgreSQL schema, pilot seed data, live-readiness views, and checksum-protected migration runner.
- PostgreSQL persistence layer for companies, quotes, SEC filings, and selected SEC facts.
- Automatic persistence after successful quote, SEC company, filing, and fact retrieval.
- Tested pilot refresh command for AAPL, selected tickers, or the original 15-stock pilot.
- Database-backed pilot and Top 25 readiness API with no connection-string exposure.
- Render Blueprint declaration for a private PostgreSQL database, automatic migrations, and pre-start database verification.
- Honest feed and SEC-context disclosures.
- Safe unconfigured-provider behavior when credentials, the SEC user agent, or the database are absent.
- Automated route, secret-exposure, malformed-symbol, batch-limit, cache, partial-failure, persistence, stored-retrieval, quote-normalization, missing-price, SEC-filing, SEC-fact, pilot-refresh, and readiness tests.
- GitHub Actions workflow for typechecking and tests on backend pushes and pull requests.
- Public runtime configuration file with no credentials.
- Landing-page and dedicated Monster Check™ live quote and latest-filing client.
- Live Data Rollout Board prepared to read saved readiness directly from the API.
- Automatic retention of clearly labeled demonstration data when the live API is absent or unavailable.

Not completed or confirmed yet:

- Confirmed creation and successful migration of the declared Render PostgreSQL service.
- A genuine production AAPL record saved, followed by an API restart and successful retrieval.
- Saved production Monster Rating™ records.
- Licensed raw market-data feed for public redistribution. TradingView's free public widgets remain the visible chart-and-price source until one is selected.
- News provider.
- Monster Rating™ Version 1 engine.
- Rating history refresh jobs.

## Local setup

1. Install Node.js 20 or later.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add a private `DATABASE_URL` before running migrations.
5. Run `npm run db:migrate`.
6. Run `npm run db:verify`.
7. Set `MARKET_DATA_PROVIDER=twelve-data` only after adding a valid `TWELVE_DATA_API_KEY`.
8. Replace the placeholder in `SEC_USER_AGENT` with a real project identifier and contact email before using SEC routes.
9. Run `npm run check`.
10. Run `npm run dev`.

The development server defaults to `http://localhost:8787`.

## Pilot refresh commands

Refresh AAPL and verify that the saved record can be read back:

```bash
npm run pilot:refresh -- AAPL
```

Refresh selected tickers:

```bash
npm run pilot:refresh -- AAPL MSFT NVDA
```

Refresh the original 15-stock pilot:

```bash
npm run pilot:refresh -- --all
```

The command requires `DATABASE_URL` and `SEC_USER_AGENT`. It saves SEC identity, recent filings, and selected company facts. It saves a quote only when an approved market-data provider is configured. A missing or failed quote provider does not erase successful SEC progress, and the command fails if the saved company cannot be read back from PostgreSQL.

## Safety rules

- Never commit `.env`, `DATABASE_URL`, or provider keys.
- Never place provider or database credentials in GitHub Pages JavaScript.
- Never expose a public database-write endpoint without authentication and authorization.
- Never describe the Twelve Data default U.S. feed as a full consolidated SIP quote.
- Never use an individual/internal/non-display market-data plan for public redistribution. Confirm display rights before enabling a raw quote provider on the public site.
- Do not purchase real-time exchange speed merely for appearance: Next Year’s Monsters™ is designed to work with clearly timestamped delayed or end-of-day data.
- Never expose the Twelve Data key, SEC contact address, or database connection string in an API response.
- Never fabricate a quote, filing, fact, readiness result, stored record, or source when a provider is missing or unavailable.
- Retain SEC fact form, fiscal period, unit, period dates, filed date, accession number, and source link.
- Keep SEC traffic below its fair-access ceiling; this adapter serializes requests and spaces them apart, while production deployment will also require shared rate limiting and caching.
- Never return a Monster Rating™ without a version, timestamp, evidence, risks, and source references.

## Verification

Run:

```bash
npm run check
```

That command performs:

- Production TypeScript checking.
- Test TypeScript checking.
- Node test execution through `tsx`.

The GitHub Actions workflow `.github/workflows/backend-checks.yml` runs the same command whenever backend files change on `main` or in a pull request targeting `main`.

## Expected behavior without credentials

- `/api/health` returns HTTP 200 and reports each provider’s configured status.
- `/api/provider-status` confirms that market-data, SEC, and database secrets are not exposed.
- `/api/readiness` and `/api/stored/:symbol` return HTTP 503 until `DATABASE_URL` is configured.
- `/api/tickers`, `/api/quotes/:symbol`, and `/api/quotes?symbols=...` return HTTP 503 rather than fabricated market data.
- `/api/sec/company/:symbol`, `/api/sec/filings/:symbol`, and `/api/sec/facts/:symbol` return HTTP 503 until `SEC_USER_AGENT` is configured.
- The website continues showing the labeled 15-stock demonstration when live services are unavailable.

## Expected behavior with providers configured

With Twelve Data configured:

- `/api/tickers?q=apple` returns supported U.S. common-stock matches.
- `/api/quotes/AAPL` returns a normalized timestamped quote with provider and feed-disclosure fields.
- `/api/quotes?symbols=AAPL,NVDA,MSFT` returns independent per-symbol results, summary counts, retrieval time, and cache policy without exposing the provider key.

With a valid SEC user agent configured:

- `/api/sec/company/AAPL` resolves ticker, CIK, company name, and exchange from the SEC mapping.
- `/api/sec/filings/AAPL` returns recent filing metadata and official document links.
- `/api/sec/facts/AAPL` returns selected latest periodic XBRL facts with complete reporting context and official source links.

With PostgreSQL configured and migrated:

- Successful quote and SEC requests save normalized records automatically.
- `/api/stored/AAPL` returns the saved company, latest quote, latest filing, and stored record counts.
- `/api/readiness` returns pilot totals, Top 25 totals, pending tickers, per-company readiness checks, and the genuine latest successful saved update.
- A missing database or missing stored ticker produces an explicit unavailable or not-found response rather than invented progress.

With a verified public API address configured:

- Monster Check™ displays the current price, change, freshness, provider timestamp, feed disclosure, and latest official SEC filing above the demonstration analysis.
- The Live Data Rollout Board displays saved readiness from `/api/readiness`.
- If a request fails, the page explicitly retains the demonstration or static fallback instead of substituting a false value.

## Next implementation

1. Confirm Render synchronized the Blueprint, created PostgreSQL, ran migrations, and passed `db:verify`.
2. Run `npm run pilot:refresh -- AAPL` inside the configured Render service.
3. Restart or redeploy the API.
4. Confirm `/api/stored/AAPL` returns the same saved records after restart.
5. Repeat the persistence proof once more.
6. Begin Monster Rating™ Version 1 only after the live-data path passes twice.
