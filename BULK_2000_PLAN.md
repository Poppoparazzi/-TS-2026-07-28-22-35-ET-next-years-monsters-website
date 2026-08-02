# Next Year’s Monsters™ — Bulk 2,000-Stock Plan

<!-- TS: 2026-08-02 14:17 ET -->

## Core decision

Stop building stocks one at a time. The original 15 remain the pilot and visual proof set. From this point forward, new coverage must be created by a repeatable bulk pipeline.

## What the system must do

1. Load the full target universe from an official ticker source.
2. Normalize ticker, company name, exchange, and SEC CIK.
3. Process companies in batches with rate limits, retry rules, and failure isolation.
4. Save SEC identity, recent filings, and company facts for every company.
5. Save licensed live or delayed quote snapshots when a market-data provider is connected.
6. Calculate Monster Rating™ through one versioned scoring engine, not handcrafted page text.
7. Record source, timestamp, scoring version, missing evidence, and failure reason for every company.
8. Publish progress counts and searchable status from one bulk-status endpoint.
9. Re-run only stale or failed companies instead of rebuilding the entire universe.
10. Keep demonstration VCL™ material separate from current production ratings.

## Immediate build order

### Phase 1 — Build the factory

- Add a bulk universe table and importer.
- Add a batch-processing queue with configurable concurrency.
- Add retry, stale-record, and failed-record logic.
- Add one bulk status endpoint for the entire universe.
- Add progress counters: total, queued, processing, SEC complete, quote complete, rating complete, failed, and stale.

### Phase 2 — Prove scale

Run the exact same pipeline at these checkpoints:

1. 15 companies
2. 100 companies
3. 500 companies
4. 2,000 companies

No new custom stock pages are to be created during this phase.

### Phase 3 — Connect ratings

- Connect a licensed live or delayed quote provider.
- Define the first versioned Monster Rating™ formula.
- Calculate ratings in bulk.
- Rank the current leaders automatically.
- Keep unrated and incomplete companies clearly labeled.

## Throughput targets

- SEC identity and basic company profiles: hundreds per run, subject to SEC rate limits.
- Quote snapshots: provider-dependent, processed in batches.
- Rating calculations: bulk database job, not one company per day.
- Failed companies: logged and retried without stopping successful companies.

## Rules that prevent another slowdown

- No handcrafted profile page for each new stock.
- No manual rewriting of the same layout for each company.
- No claim that a demonstration score is a current production rating.
- No waiting for all 2,000 companies before showing progress.
- Every milestone must produce a visible count and a committed result.

## Next concrete coding task

Create the bulk universe importer, batch job, and one bulk-status endpoint. The first visible milestone is 100 companies moving through the same SEC pipeline without individual editing.
