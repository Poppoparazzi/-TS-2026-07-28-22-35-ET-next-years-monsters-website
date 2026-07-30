# Next Year’s Monsters™ API

<!-- TS: 2026-07-29 21:55 ET -->

This folder contains the provider-neutral TypeScript backend for the live-data phase of Monster Check™.

## Current status

Implemented:

- Fastify TypeScript service scaffold.
- `GET /api/health`.
- `GET /api/provider-status`.
- `GET /api/readiness`.
- `GET /api/tickers?q=apple`.
- `GET /api/quotes/AAPL`.
- `GET /api/sec/company/AAPL`.
- `GET /api/sec/filings/AAPL?limit=10`.
- `GET /api/sec/facts/AAPL`.
- Secure environment-variable configuration.
- Provider-neutral market-data and SEC-data contracts.
- Twelve Data quote and symbol-search adapter.
- Official SEC ticker mapping, submissions, filing links, and selected XBRL company-facts adapter.
- PostgreSQL schema, pilot seed data, live-readiness views, and checksum-protected migration runner.
- Database-backed pilot and Top 25 readiness API with no connection-string exposure.
- Honest feed and SEC-context disclosures.
- Safe unconfigured-provider behavior when credentials, the SEC user agent, or the database are absent.
- Automated route, secret-exposure, malformed-symbol, quote-normalization, missing-price, SEC-filing, SEC-fact, and readiness tests.
- GitHub Actions workflow for typechecking and tests on backend changes.
- Public runtime configuration file with no credentials.
- Landing-page and dedicated Monster Check™ live quote and latest-filing client.
- Live Data Rollout Board prepared to read saved readiness directly from the API.
- Automatic retention of clearly labeled demonstration data when the live API is absent or unavailable.

Not implemented yet:

- Deployed public API URL.
- Active public API address in `assets/runtime-config.js`.
- Provisioned private PostgreSQL service with migrations applied.
- Saved production quote, filing, and rating records.
- News provider.
- Monster Rating™ Version 1 engine.
- Rating history refresh jobs.

## Local setup

1. Install Node.js 20 or later.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add a private `DATABASE_URL` before running migrations.
5. Run `npm run db:migrate`.
6. Set `MARKET_DATA_PROVIDER=twelve-data` only after adding a valid `TWELVE_DATA_API_KEY`.
7. Replace the placeholder in `SEC_USER_AGENT` with a real project identifier and contact email before using SEC routes.
8. Run `npm run check`.
9. Run `npm run dev`.

The development server defaults to `http://localhost:8787`.

## Safety rules

- Never commit `.env`, `DATABASE_URL`, or provider keys.
- Never place provider or database credentials in GitHub Pages JavaScript.
- Never describe the Twelve Data default U.S. feed as a full consolidated SIP quote.
- Never expose the Twelve Data key, SEC contact address, or database connection string in an API response.
- Never fabricate a quote, filing, fact, readiness result, or source when a provider is missing or unavailable.
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

The GitHub Actions workflow `.github/workflows/backend-checks.yml` runs the same command whenever backend files change on `main`.

## Expected behavior without credentials

- `/api/health` returns HTTP 200 and reports each provider’s configured status.
- `/api/provider-status` confirms that market-data, SEC, and database secrets are not exposed.
- `/api/readiness` returns HTTP 503 until `DATABASE_URL` is configured.
- `/api/tickers` and `/api/quotes/:symbol` return HTTP 503 rather than fabricated market data.
- `/api/sec/company/:symbol`, `/api/sec/filings/:symbol`, and `/api/sec/facts/:symbol` return HTTP 503 until `SEC_USER_AGENT` is configured.
- The website continues showing the labeled 15-stock demonstration because the public runtime API address remains blank.

## Expected behavior with providers configured

With Twelve Data configured:

- `/api/tickers?q=apple` returns supported U.S. common-stock matches.
- `/api/quotes/AAPL` returns a normalized timestamped quote with provider and feed-disclosure fields.

With a valid SEC user agent configured:

- `/api/sec/company/AAPL` resolves ticker, CIK, company name, and exchange from the SEC mapping.
- `/api/sec/filings/AAPL` returns recent filing metadata and official document links.
- `/api/sec/facts/AAPL` returns selected latest periodic XBRL facts with complete reporting context and official source links.

With PostgreSQL configured and migrated:

- `/api/readiness` returns pilot totals, Top 25 totals, pending tickers, per-company readiness checks, and the genuine latest successful saved update.
- The public Live Data Rollout Board replaces its static checklist with saved database status.
- A missing or failed readiness response leaves the static checklist visible and does not invent progress.

With a verified public API address configured:

- Monster Check™ displays the current price, change, freshness, provider timestamp, feed disclosure, and latest official SEC filing above the demonstration analysis.
- The Live Data Rollout Board displays saved readiness from `/api/readiness`.
- If a request fails, the page explicitly retains the demonstration or static fallback instead of substituting a false value.

## Next implementation

1. Confirm the backend typechecks and tests are green.
2. Provision the private PostgreSQL service and apply migrations.
3. Deploy the backend using `render.yaml`.
4. Configure `DATABASE_URL`, the market-data key, and SEC user agent only on the host.
5. Add the verified API address to `assets/runtime-config.js`.
6. Save and display the first genuine AAPL quote and SEC status.
7. Begin Monster Rating™ Version 1 only after the first live-data path passes twice.
