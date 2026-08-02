# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 14:46 ET -->

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
- The repository now contains `BULK_2000_PLAN.md`. New coverage must use a repeatable bulk pipeline rather than handcrafted stock pages.
- Backend version `0.5.0` now includes an official SEC universe parser, bulk database importer, and `/api/universe/status` endpoint.
- Render is configured to import the first 100 SEC companies automatically at startup through `AUTO_IMPORT_UNIVERSE_LIMIT=100`.
- The importer reuses the existing `companies` table, normalizes tickers and CIKs, deduplicates ticker/CIK collisions, and imports the selected universe in one database transaction.
- `/api/universe/status?limit=100` reports universe size, SEC identity coverage, filing coverage, fact coverage, quote coverage, rating coverage, fully complete count, incomplete count, and per-company status.
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
10. Added parser and endpoint tests.
11. Backend TypeScript, tests, and static-site checks passed for the bulk-universe milestone:
    - Phase 3 Backend Checks run `30761148428`
    - Static site checks run `30761148461`

## Immediate next work

1. Build a batch SEC evidence processor that selects imported companies missing filings or facts and refreshes them with controlled concurrency, retries, and failure isolation.
2. Add bulk-processing progress fields: queued, processing, SEC complete, failed, stale, and last error.
3. Confirm Render deployed backend version `0.5.0` and imported the first 100 companies.
4. Confirm `SEC_USER_AGENT` is set in Render. Automatic SEC work cannot run without it.
5. Inspect `/api/universe/status?limit=100` after deployment and verify the stored counts.
6. Increase the same pipeline checkpoints from 100 to 500 and then 2,000 only after the 100-company run is proven.
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
