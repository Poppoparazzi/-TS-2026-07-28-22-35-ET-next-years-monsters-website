<!-- TS: 2026-07-29 16:14 ET -->

# Next Year’s Monsters™ Database

This directory contains the permanent PostgreSQL history layer for Phase 3.

## What is stored

- Active stock universe and the original 15-company pilot.
- Timestamped quote snapshots with provider and feed disclosure.
- Official SEC filing metadata and document links.
- Selected SEC company facts with complete reporting context.
- Versioned Monster Rating™ calculations.
- Every rating component, weight, explanation, risk, and source.
- Refresh-run success and failure records.
- Immutable leaderboard snapshots and ranking history.
- Public freshness timestamps derived from successful saved data.

## Migration order

Apply these files in filename order:

1. `migrations/001_initial_schema.sql`
2. `migrations/002_seed_pilot_companies.sql`
3. `migrations/003_live_readiness_views.sql`

Production deployment will run migrations against a private PostgreSQL database through `DATABASE_URL`. The public GitHub Pages site must never receive that connection string.

## Original 15 live gate

```sql
SELECT * FROM pilot_live_gate;
```

The pilot is ready only when:

- Exactly 15 pilot companies exist.
- Every company has a saved quote whose freshness is not stale or unavailable.
- Every company has an SEC filing status.
- Every company has a complete, versioned Monster Rating™.
- Every rating has identifiable evidence and sources.

Until then, `pilot_is_live_ready` remains false and `pending_tickers` identifies the unfinished companies.

## Top 25 live gate

```sql
SELECT * FROM top_25_live_gate;
```

The public Top 25 can switch from `PENDING` to `LIVE` only when:

- The candidate set contains exactly 25 companies.
- All 25 pass the same quote, SEC, rating, evidence, and source checks.
- The database returns `top_25_is_live_ready = true`.

The page’s public “Last Updated” value must come from `last_successful_update`. It must never be generated from the visitor’s browser clock or entered manually as though static content were fresh market data.

## Per-company readiness

```sql
SELECT
  ticker,
  has_verified_quote,
  quote_is_usable,
  has_sec_status,
  has_saved_versioned_rating,
  has_rating_evidence,
  is_live_ready,
  last_successful_update
FROM company_live_readiness
ORDER BY is_pilot DESC, ticker;
```

This query provides an auditable checklist for every company and prevents one incomplete stock from silently entering the live leaderboard.

## Safety rule

No database row means no public claim. Missing, stale, partial, or failed provider data must remain visibly unavailable rather than being replaced with a demonstration value.
