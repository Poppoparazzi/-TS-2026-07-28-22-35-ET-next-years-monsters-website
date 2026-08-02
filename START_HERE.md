# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 14:03 ET -->

This file is the permanent starting point for every future ChatGPT or Codex session working on this website.

## Repository

`Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`

## Live GitHub Pages test site

`https://poppoparazzi.github.io/-TS-2026-07-28-22-35-ET-next-years-monsters-website/`

## First instruction for every new chat

Open and read these files before making any changes:

1. `START_HERE.md`
2. `PROJECT_HANDOFF_2026-07-29.md`
3. The latest relevant files and commits in the repository

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
- The verification ledger reports SEC identity, stored filing/fact evidence, stored quote status, production rating-history status, last stored check, and evidence gaps.
- The verification ledger is linked from the VCL™ Library and added to site-wide navigation.
- The Website Data Status page now creates production connection cards for the public API, market-data provider, official SEC service, and production database using `/api/health`.
- The repository has a static-site validation workflow that checks browser JavaScript syntax, local links, VCL tier order/color hooks, all 15 ledger tickers, and the correct SEC and stored-snapshot routes.
- A guarded startup pilot refresh now checks persistent records and refreshes only missing or records older than 24 hours.
- The guarded refresh saves official SEC company identity, filings, and facts even while market quotes remain unconfigured.
- Refresh failures are logged without stopping the public API.
- Render is configured to enable the guarded startup refresh with a 24-hour maximum age.
- `MARKET_DATA_PROVIDER` remains deliberately set to `unconfigured`; no live or delayed quote provider is currently connected.
- The 15 companies remain the VCL™ demonstration/pilot set. They are not yet represented as a freshly verified live ranking of today’s top 15 stocks.
- Do not fabricate live ratings, live quotes, or current news.

## Completed and validated on August 2, 2026

1. Reordered and color-coded the 15-stock VCL™ table.
2. Reduced oversized and cramped live-data board typography.
3. Added the live 15-stock verification ledger page.
4. Added the verification ledger to the VCL™ page and site-wide navigation.
5. Kept historical demonstration scores visibly separate from stored production rating records.
6. Added automated static-site checks; GitHub Actions validation passed.
7. Added public provider-health cards to the Website Data Status page; validation passed.
8. Added the guarded stale-record startup refresh for the 15 pilot companies.
9. Backend TypeScript, tests, and static-site checks passed for the startup refresh:
   - Phase 3 Backend Checks run `30759597685`
   - Static site checks run `30759597683`

## Immediate next work

1. Confirm Render deployed the latest `main` commits and that `/api/health` reports the expected API, SEC, and database states.
2. Confirm `SEC_USER_AGENT` is set in Render. The automatic SEC refresh cannot run without it.
3. Inspect the 15-stock verification ledger after startup refresh and confirm which persistent records were actually created.
4. Confirm database migrations and readback through `/api/stored/:symbol` in production.
5. Connect a reliable licensed live/delayed quote source and preserve clear timestamps and source labels.
6. Test Monster Check™, Top Monsters, charts, News Radar, Start Here, Verification, Data Status, and navigation on desktop and mobile.
7. Review remaining pages for oversized typography, accidental wrapping, and inconsistent rating colors.
8. Update this file after each completed milestone and commit every completed change immediately to `main`.

## Locked design and data rules

- Preserve the approved cream, black, red, gold, and lime editorial design.
- Keep Captain Breakout™ exactly as approved and use `object-fit: contain` where appropriate.
- The screen finds evidence; it does not promise winners.
- Use clearly labeled demonstration data until licensed APIs and the production scoring engine are connected and verified.
- Do not claim the 15 VCL™ companies are the current Top 15 unless the current scoring process has actually verified and ranked them.
- Use only the approved TuneTank bull-mad-mooing WAV later if the bull sound is added.

## Recovery rule

If a ChatGPT conversation disappears, open a new chat and paste this instruction:

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md` and `PROJECT_HANDOFF_2026-07-29.md` first. Treat the repository as the source of truth and verify the latest commits before describing project status.
