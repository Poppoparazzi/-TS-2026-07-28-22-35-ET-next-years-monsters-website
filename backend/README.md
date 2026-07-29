# Next Year’s Monsters™ API

<!-- TS: 2026-07-29 12:09 ET -->

This folder contains the provider-neutral TypeScript backend for the live-data phase of Monster Check™.

## Current status

Implemented:

- Fastify TypeScript service scaffold.
- `GET /api/health`.
- `GET /api/provider-status`.
- `GET /api/tickers?q=apple`.
- `GET /api/quotes/AAPL`.
- `GET /api/sec/company/AAPL`.
- `GET /api/sec/filings/AAPL?limit=10`.
- `GET /api/sec/facts/AAPL`.
- Secure environment-variable configuration.
- Provider-neutral market-data and SEC-data contracts.
- Twelve Data quote and symbol-search adapter.
- Official SEC ticker mapping, submissions, filing links, and selected XBRL company-facts adapter.
- Honest feed and SEC-context disclosures.
- Safe unconfigured-provider behavior when credentials or the required SEC user agent are absent.
- Automated route, secret-exposure, malformed-symbol, quote-normalization, missing-price, SEC-filing, and SEC-fact tests.
- GitHub Actions workflow for typechecking and tests on backend changes.
- Public runtime configuration file with no credentials.
- Landing-page and dedicated Monster Check™ live quote and latest-filing client.
- Automatic retention of the clearly labeled demonstration when the live API is absent or unavailable.

Not implemented yet:

- Deployed public API URL.
- Active public API address in `assets/runtime-config.js`.
- PostgreSQL database.
- News provider.
- Monster Rating™ Version 1 engine.
- Rating history.

## Local setup

1. Install Node.js 20 or later.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MARKET_DATA_PROVIDER=twelve-data` only after adding a valid `TWELVE_DATA_API_KEY`.
5. Replace the placeholder in `SEC_USER_AGENT` with a real project identifier and contact email before using SEC routes.
6. Run `npm run check`.
7. Run `npm run dev`.

The development server defaults to `http://localhost:8787`.

## Safety rules

- Never commit `.env` or provider keys.
- Never place provider credentials in the GitHub Pages JavaScript.
- Never describe the Twelve Data default U.S. feed as a full consolidated SIP quote.
- Never expose the Twelve Data key or SEC contact address in an API response.
- Never fabricate a quote, filing, fact, or source when a provider is missing or unavailable.
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
- `/api/provider-status` confirms that secrets and the SEC user agent are not exposed.
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
- `/api/sec/facts/AAPL` returns selected latest periodic XBRL facts with their complete reporting context and official source links.

With a verified public API address configured:

- Monster Check™ displays the current price, change, freshness, provider timestamp, feed disclosure, and latest official SEC filing above the demonstration analysis.
- If the quote request fails, the page explicitly activates the demonstration fallback instead of substituting a false value.

## Next implementation

1. Confirm the GitHub Actions verification run is green and fix any reported issue.
2. Deploy the backend using `render.yaml`.
3. Configure the market-data key and SEC user agent only on that host.
4. Add the verified API address to `assets/runtime-config.js`.
5. Confirm the live quote and SEC filing panel on both Monster Check™ surfaces.
6. Add a PostgreSQL schema for tickers, quotes, filings, facts, ratings, and rating history.
7. Begin Monster Rating™ Version 1 only after live quote and SEC data pass deployment checks.
