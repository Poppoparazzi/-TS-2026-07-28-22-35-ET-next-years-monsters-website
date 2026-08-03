# Next Year’s Monsters™ — Controlled 2,000-Company Rollout

<!-- TS: 2026-08-02 21:48 ET -->

## Purpose

Expand the production SEC universe from 500 examined companies to 2,000 without creating individual stock pages, inventing quotes, or presenting demonstration ratings as current production results.

This rollout keeps four systems plainly separate:

1. SEC identity, filings, and company facts
2. licensed market quotes, which remain unconfigured
3. versioned Monster Ratings™, which remain unconfigured
4. the 15 VCL™ demonstration companies, which remain examples rather than a current Top 15

## Safety change completed before expansion

The SEC processor now claims work in concurrency-sized waves instead of marking an entire large batch as processing at once.

With `SEC_BATCH_CONCURRENCY=3`, at most three records can be stranded by an interrupted deployment. The existing abandoned-job recovery can reclaim those records on the next run. A restart can no longer leave hundreds of untouched records falsely labeled as processing.

## Non-negotiable gate

Do not begin the 2,000-company rollout until the production 500-company milestone is verified with all of these conditions:

- `examinedCount = 500`
- `processingCount = 0`
- `failedCount = 0`
- `secCompleteCount + unresolvedCount = 500`
- the production smoke workflow passes
- `START_HERE.md` records the final totals and workflow run

## Capability preparation

The backend may accept a requested SEC batch up to 2,500 companies, while the intended production target remains 2,000.

The capability-only change must not alter these production values yet:

- `AUTO_IMPORT_UNIVERSE_LIMIT=500`
- `AUTO_SEC_BATCH_SIZE=500`
- factory dashboard limit `500`
- production smoke expectation `500`

This allows backend validation without silently starting the expansion.

## Rollout A — Import 2,000, process none

Change only the production bootstrap settings needed to import the larger universe:

- `AUTO_IMPORT_UNIVERSE_LIMIT=2000`
- `AUTO_SEC_BATCH_SIZE=0`
- keep `SEC_BATCH_CONCURRENCY=3`
- keep `MARKET_DATA_PROVIDER=unconfigured`

Deploy once and verify:

- backend version remains `0.6.0` unless intentionally versioned
- `universeSize >= 2000`
- `/api/universe/status?limit=2000` returns 2,000 examined companies
- the original 500 terminal SEC records remain complete or unresolved
- the newly imported companies are queued
- no quotes or Monster Ratings™ appear

This separates database expansion from SEC traffic. Importing and processing are not allowed to fail together in one opaque startup event.

## Rollout B — Process the queued SEC companies

After Rollout A is verified, change:

- `AUTO_SEC_BATCH_SIZE=2000`
- `SEC_BATCH_CONCURRENCY=3`
- `SEC_BATCH_MAX_AGE_HOURS=168`

The seven-day max age prevents the already completed 500-company milestone from being unnecessarily refreshed during the initial expansion. The queue should select the newly queued companies first and process them in waves of three.

Update the public factory dashboard and production smoke workflow to use a 2,000-company limit during this rollout.

Verify continuously:

- pipeline-state counts always reconcile to `examinedCount`
- active `processingCount` remains no greater than the controlled wave size except during a brief recovery transition
- permanent SEC 404 results become `unresolved`
- temporary failures retain retry information
- quotes remain `0` while the market provider is unconfigured
- ratings remain `0` while the production scoring engine is unconfigured

Final 2,000-company completion requires:

- `examinedCount = 2000`
- `processingCount = 0`
- `failedCount = 0`
- `queuedCount = 0`
- `partialCount = 0`
- `staleCount = 0`
- `secCompleteCount + unresolvedCount = 2000`
- production smoke passes against the 2,000-company state

## Rollout C — Lock the completed bootstrap

After the 2,000-company milestone passes:

- set `AUTO_SEC_BATCH_SIZE=0`
- keep the 2,000-company universe imported
- record final totals in `START_HERE.md`
- record the exact production smoke run
- close any temporary monitoring pull request

Do not leave a 2,000-company startup refresh enabled on every future deployment. Ongoing SEC maintenance needs its own scheduled stale-record job rather than making every website deployment reprocess the full universe.

## Dashboard rules

The factory dashboard may display 2,000 rows from the shared status endpoint. It must not create 2,000 handcrafted HTML profile pages.

The dashboard must continue to distinguish:

- queued
- in batch
- SEC complete
- unresolved
- retry failure
- filings present
- facts present
- quote absent or present
- rating absent or present

## Data claims that remain prohibited

Until separate licensed and versioned systems are connected, the website must not claim:

- current or delayed quotes from the SEC
- current Monster Ratings™
- a live Top 15 ranking
- current news generated from demonstration text
- complete coverage for unresolved SEC identities

The SEC factory supplies evidence. It does not supply prices, recommendations, or guaranteed winners.
