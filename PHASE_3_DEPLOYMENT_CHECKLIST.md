# Phase 3 Backend Deployment Checklist

<!-- TS: 2026-07-29 12:34 ET -->

## What is ready

The repository now contains:

- A Fastify and TypeScript backend under `backend/`.
- Market-data provider contracts and a Twelve Data adapter.
- SEC EDGAR ticker, submissions, filing, and selected XBRL fact adapters.
- Route and provider safety tests.
- GitHub Actions verification configuration.
- A Render Blueprint at `render.yaml`.
- A health endpoint at `/api/health`.

## What deployment will create

The initial Render service name is:

`next-years-monsters-api`

The Blueprint builds only the `backend/` directory, runs all checks, compiles TypeScript, starts the API, and verifies `/api/health` before treating a deployment as healthy.

## Required values that must not be committed

Render will prompt for these values during the first Blueprint deployment:

### `TWELVE_DATA_API_KEY`

A valid Twelve Data development API key. It must exist only in the hosting provider’s encrypted environment settings.

### `SEC_USER_AGENT`

A project identifier and genuine contact address, for example:

`NextYearsMonsters/0.2 contact@example.com`

Replace the placeholder with the real project contact. The backend sends this header to the SEC but never returns it to website visitors.

## Initial deployment steps

1. Sign in to Render.
2. Create a new Blueprint.
3. Connect this GitHub repository and select `render.yaml`.
4. Enter the two required environment values when prompted.
5. Allow the build to run.
6. Confirm that the deployment health check passes.
7. Copy the resulting `onrender.com` API address.
8. Test:
   - `/api/health`
   - `/api/provider-status`
   - `/api/quotes/AAPL`
   - `/api/sec/company/AAPL`
   - `/api/sec/filings/AAPL?limit=5`
   - `/api/sec/facts/AAPL`
9. Add the verified API address to the website’s public runtime configuration.
10. Test the demonstration fallback by temporarily making the API unavailable.

## Honest limitation of the initial free service

The Blueprint intentionally uses Render’s free instance for the first engineering deployment. A free service may spin down after inactivity and take time to wake up. That is acceptable for proving the connection, but not for the finished public Monster Check™ experience.

Before public launch, move the service to an always-on paid instance or another production host that meets the site’s responsiveness requirements.

## Deployment acceptance test

The first deployment is accepted only when:

- The API key and SEC contact are absent from all responses and logs intended for public viewing.
- `/api/health` returns HTTP 200.
- `/api/quotes/AAPL` returns a numeric price, provider timestamp, retrieval timestamp, freshness label, provider name, and feed disclosure.
- `/api/sec/filings/AAPL` returns official SEC source links.
- `/api/sec/facts/AAPL` returns facts with form, fiscal period, unit, dates, accession number, and source link.
- An invalid symbol returns HTTP 400.
- A missing provider returns HTTP 503 rather than invented data.
- The public site remains usable with the clearly labeled 15-stock demonstration when the API is unavailable.

## Next code step after the API address exists

Connect Monster Check™ to the deployed API using a public, non-secret base URL. The browser will request normalized data from our backend; it will never call Twelve Data or SEC EDGAR directly with private credentials.
