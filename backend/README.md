# Next Year’s Monsters™ API

<!-- TS: 2026-07-29 10:49 ET -->

This folder contains the provider-neutral TypeScript backend for the live-data phase of Monster Check™.

## Current status

Implemented:

- Fastify TypeScript service scaffold.
- `GET /api/health`.
- `GET /api/provider-status`.
- `GET /api/tickers?q=apple`.
- `GET /api/quotes/AAPL`.
- Secure environment-variable configuration.
- Provider-neutral market-data contracts.
- Twelve Data quote and symbol-search adapter.
- Honest feed disclosure in every normalized quote.
- Safe unconfigured-provider behavior when no API key is present.

Not implemented yet:

- Deployed public API URL.
- PostgreSQL database.
- SEC filing adapter.
- News provider.
- Monster Rating™ Version 1 engine.
- Rating history.
- Front-end connection to the backend.

## Local setup

1. Install Node.js 20 or later.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `MARKET_DATA_PROVIDER=twelve-data` only after adding a valid `TWELVE_DATA_API_KEY`.
5. Provide a real contact address in `SEC_USER_AGENT` before SEC integration.
6. Run `npm run dev`.

The development server defaults to `http://localhost:8787`.

## Safety rules

- Never commit `.env` or provider keys.
- Never place provider credentials in the GitHub Pages JavaScript.
- Never describe the Twelve Data default U.S. feed as a full consolidated SIP quote.
- Never expose raw provider error payloads containing account details.
- Never return a Monster Rating™ without a version, timestamp, evidence, risks, and source references.

## First checks

With no provider key configured:

- `/api/health` should return HTTP 200 and report `configured: false`.
- `/api/provider-status` should confirm no secret is exposed.
- `/api/tickers` and `/api/quotes/:symbol` should return HTTP 503 rather than fabricated data.

With Twelve Data configured:

- `/api/tickers?q=apple` should return supported U.S. common-stock matches.
- `/api/quotes/AAPL` should return a normalized timestamped quote with provider and feed-disclosure fields.

## Next implementation

1. Add automated tests for health, configuration, ticker search, and quote normalization.
2. Add SEC submissions and XBRL company-facts adapters.
3. Add a PostgreSQL schema for tickers, quotes, filings, ratings, and rating history.
4. Deploy the backend to a secure host.
5. Connect the public website with the existing demonstration data retained as a visible fallback.
