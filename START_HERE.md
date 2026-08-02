# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 15:20 ET -->

This file is the permanent starting point for every future ChatGPT or Codex session working on this website.

## Repository

`Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`

## Live GitHub Pages test site

`https://poppoparazzi.github.io/-TS-2026-07-28-22-35-ET-next-years-monsters-website/`

## First instruction for every new chat

Open and read these files before making any changes:

1. `START_HERE.md`
2. `PROJECT_HANDOFF_2026-07-29.md`
3. `BULK_2000_PLAN.md`
4. The latest relevant files and commits in the repository

Do not rely on prior chat memory as the source of truth. The repository and its handoff files are the source of truth.

## Current verified project status

- GitHub Pages static website exists and the redesigned editorial landing page is committed.
- The approved Captain Breakout™ branding is installed. Do not replace, crop, redesign, or regenerate the approved character artwork.
- A public `start-here.html` guide has been added, with HOME and START HERE navigation helpers across the site.
- Monster Check™ now has a launch-style result renderer with Monster Rating™, tier, Tipping Point™, Market Weather™, Move Driver™, Monster DNA™, chart access, News Radar access, and clearly labeled demonstration language.
- All 15 original VCL™ pilot companies now appear as Monster Check™ quick picks: AAPL, NVDA, MNST, AMZN, TSLA, NFLX, AMD, COST, VRT, AXON, DECK, WING, META, APP, and MSFT.
- The VCL™ Library table is ordered by tier, then highest demonstration score, then ticker. Platinum, Gold, and Silver groups have matching row accents and tier badges.
- The cramped live-data board typography was reduced, the filing column was widened, and responsive wrapping was improved.
- `verification-ledger.html` checks the 15 pilot companies against the public SEC company service and persistent production snapshots.
- The Website Data Status page creates production connection cards for the public API, market-data provider, official SEC service, and production database using `/api/health`.
- A guarded startup pilot refresh saves official SEC identity, filings, and facts for missing or stale pilot records.
- `MARKET_DATA_PROVIDER` remains deliberately set to `unconfigured`; no live or delayed quote provider is currently connected.
- The 15 companies remain the VCL™ demonstration/pilot set. They are not represented as a freshly verified live ranking of today’s top 15 stocks.
- The repository contains `BULK_2000_PLAN.md`. New coverage must use a repeatable bulk pipeline rather than handcrafted stock pages.
- Backend version `0.6.0` includes the official SEC universe parser, bulk importer, retry-safe SEC worker queue, and `/api/universe/status` endpoint.
- Render is configured to import the first 100 SEC companies automatically through `AUTO_IMPORT_UNIVERSE_LIMIT=100`.
- Render is also configured to process a 100-company SEC evidence batch through `AUTO_SEC_BATCH_SIZE=100`, with concurrency `3` and a 24-hour stale threshold.
- The importer reuses the existing `companies` table, normalizes tickers and CIKs, deduplicates ticker/CIK collisions, and imports the selected universe in one transaction.
- The `company_pipeline_status` table records queued, processing, complete, partial, failed, and stale SEC states, attempt counts, retry times, last errors, and completion timestamps.
- The SEC batch queue claims work safely with PostgreSQL row locking, recovers abandoned processing jobs, and retries failures without stopping successful companies.
- `/api/universe/status?limit=100` reports universe size, queued count, processing count, SEC complete count, partial count, failed count, stale count, SEC identity coverage, filing coverage, fact coverage, quote coverage, rating coverage, and per-company status.
- The same endpoint accepts limits up to 2,500, allowing the same machinery to report 100, 500, and 2,000-company milestones.
- Do not fabricate live ratings, live quotes, or current news.

## Completed and validated on August 2, 2026

1. Reordered and color-coded the 15-stock VCL™ table.
2. Reduced oversized and cramped live-data board typography.
3. Added the live 15-stock verification ledger page.
4. Added automated static-site checks and public provider-health cards.
5. Added the guarded stale-record startup refresh for the 15 pilot companies.
6. Added the bulk 2,000-stock implementation plan.
7. Added the official SEC universe parser and 100-company importer.
8. Added the automatic Render startup import for the first 100 companies.
9. Added the bulk universe status endpoint for up to 2,500 companies.
10. Added the retry-safe SEC pipeline table, worker queue, controlled-concurrency processor, manual command, and automatic startup batch.
11. Added a deliberate one-company failure test proving the other companies continue successfully.
12. Bulk-universe validation passed:
    - Phase 3 Backend Checks run `30761148428`
    - Static site checks run `30761148461`
13. SEC batch-factory validation passed:
    - Phase 3 Backend Checks run `30761443871`
    - Static site checks run `30761443883`

## Immediate next work

1. Add a public 100-Stock Factory Status page that reads `/api/universe/status?limit=100` and displays queued, processing, complete, partial, failed, and stale counts.
2. Confirm Render deployed backend version `0.6.0`, applied migration `999_bulk_company_pipeline_status.sql`, imported the first 100 companies, and ran the first SEC batch.
3. Confirm `SEC_USER_AGENT` is set in Render. Automatic SEC work cannot run without it.
4. Inspect the production `/api/universe/status?limit=100` results and verify stored company, filing, fact, retry, and failure counts.
5. Increase the same pipeline checkpoint from 100 to 500 only after the 100-company production run is proven.
6. Increase from 500 to 2,000 only after the same queue and retry behavior remains stable.
7. Connect a licensed live/delayed quote source before producing current Monster Ratings™.
8. Update this file after each completed milestone and commit every completed change immediately to `main`.

## Locked design and data rules

- Preserve the approved cream, black, red, gold, and lime editorial design.
- Keep Captain Breakout™ exactly as approved and use `object-fit: contain` where appropriate.
- The screen finds evidence; it does not promise winners.
- Use clearly labeled demonstration data until licensed APIs and the production scoring engine are connected and verified.
- Do not claim the 15 VCL™ companies are the current Top 15 unless the current scoring process has actually verified and ranked them.
- No handcrafted profile page may be created for each new stock during the 100, 500, or 2,000-company scale tests.
- Use only the approved TuneTank bull-mad-mooing WAV later if the bull sound is added.

## Recovery rule

If a ChatGPT conversation disappears, open a new chat and paste this instruction:

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md`, `PROJECT_HANDOFF_2026-07-29.md`, and `BULK_2000_PLAN.md` first. Treat the repository as the source of truth and verify the latest commits before describing project status.
