# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 17:54 ET -->

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
4. `RENDER_DEPLOYMENT_REQUIRED.md`
5. The latest relevant files, issues, workflow results, Render production status, and commits

Do not rely on prior chat memory as the source of truth. The repository, workflow results, and verified production endpoints are the source of truth.

## Current verified project status

- The static website, Monster Check™ demonstration, VCL™ Library, verification ledger, market tools, and approved Captain Breakout™ branding are committed.
- The 15 original VCL™ companies remain the demonstration/pilot set. They are not represented as a freshly verified live ranking of today’s top 15 stocks.
- `MARKET_DATA_PROVIDER` remains deliberately set to `unconfigured`; no licensed live or delayed quote provider is currently connected.
- New stock coverage must use the bulk pipeline in `BULK_2000_PLAN.md`, not handcrafted pages.
- Render is live on backend version `0.6.0` with PostgreSQL, the SEC provider, and the bulk universe store configured.
- The first production factory run succeeded:
  - deployment commit `d8adffe`
  - 100 companies imported in one automated startup run
  - 114 active companies in the database after combining the imported universe with the original pilot records
  - 99 companies claimed for SEC processing
  - 94 completed successfully
  - 5 returned SEC EDGAR HTTP 404 responses
  - the original 15 pilot records were already fresh
- The SEC 404 records are now handled by a permanent `unresolved` state instead of receiving endless retries.
- Backend source version `0.6.0` now contains:
  - the official SEC universe parser
  - the transactional bulk importer
  - the `company_pipeline_status` table
  - queued, processing, complete, partial, failed, stale, and unresolved states
  - retry times, attempt counts, last errors, and abandoned-job recovery
  - controlled-concurrency SEC worker processing
  - permanent SEC 404 isolation
  - `/api/universe/status` for up to 2,500 companies
  - `/api/startup-status` with the deployed Render commit and startup job outcomes
- Render configuration in the repository now requests:
  - 500-company automatic import
  - 500-company SEC evidence batch
  - concurrency `3`
  - 24-hour stale threshold
  - PostgreSQL migration and verification before startup
- `factory-status.html` is now the public 500-Stock Factory Status page. It requests 500 records and shows summary counts, progress, evidence coverage, attempts, retry times, unresolved records, timestamps, and errors.
- The production smoke script now requires at least 500 stored and examined companies and reconciles unresolved records in the pipeline totals.

## Completed and validated on August 2, 2026

1. Reordered and color-coded the 15-stock VCL™ table.
2. Reduced oversized and cramped live-data board typography.
3. Added the 15-stock verification ledger and production provider-health cards.
4. Added automated static-site validation.
5. Added the guarded pilot SEC refresh.
6. Added the bulk 2,000-stock implementation plan.
7. Added the SEC universe parser and transactional importer.
8. Added the bulk universe status endpoint for up to 2,500 companies.
9. Added the retry-safe SEC pipeline table, queue, worker pool, manual command, and startup batch.
10. Added failure-isolation tests proving one company does not stop successful companies.
11. Added the public factory status page and site-wide navigation link.
12. Added production smoke testing from GitHub Actions.
13. Fixed Render free-tier deployment and PostgreSQL migration issues.
14. Proved the first 100-company production factory run through `/api/startup-status`.
15. Added the permanent unresolved SEC state and stopped retrying SEC HTTP 404 records.
16. Increased the importer and SEC batch limits from 100 to 500.
17. Upgraded the public dashboard and site-wide navigation from 100 to 500.
18. Final 500-stock backend validation passed:
    - Phase 3 Backend Checks run `30767428224`
    - Static site checks run `30767428219`
19. Final 500-stock dashboard validation passed:
    - Static site checks run `30767626605`

## Immediate next work

1. In Render, open **Blueprints → next - Years - monsters → Syncs**.
2. Run **Manual sync** and approve the two environment changes from `100` to `500`:
   - `AUTO_IMPORT_UNIVERSE_LIMIT=500`
   - `AUTO_SEC_BATCH_SIZE=500`
3. Confirm `SEC_USER_AGENT` remains populated and `DATABASE_URL` remains linked to `next-years-monsters-db`.
4. Open `next-years-monsters-api` and use **Manual Deploy → Deploy latest commit**. Do not use Restart Service.
5. Wait for the deployment to show green **Live**.
6. Confirm `/api/startup-status` reports:
   - `requestedLimit: 500`
   - `importedCount: 500`
   - the SEC batch completed with separate success, unresolved, and retry-failure counts
7. Confirm `/api/universe/status?limit=500` returns at least 500 examined companies and reconciled pipeline totals.
8. Re-run the production smoke workflow until it passes the 500-company requirement.
9. After the 500-company production run passes, increase the same system to 2,000 without creating individual stock pages.
10. Connect a licensed quote provider before producing current Monster Ratings™.

## Locked design and data rules

- Preserve the approved cream, black, red, gold, and lime editorial design.
- Keep Captain Breakout™ exactly as approved and use `object-fit: contain` where appropriate.
- The screen finds evidence; it does not promise winners.
- Use clearly labeled demonstration data until licensed APIs and the production scoring engine are connected and verified.
- Do not claim the 15 VCL™ companies are the current Top 15 unless the current scoring process has actually verified and ranked them.
- No handcrafted profile page may be created for each new stock during the 100, 500, or 2,000-company scale tests.
- Permanent SEC 404 records must remain clearly labeled unresolved and must not be treated as current verified SEC coverage.
- Use only the approved TuneTank bull-mad-mooing WAV later if the bull sound is added.

## Recovery rule

If a ChatGPT conversation disappears, open a new chat and paste this instruction:

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md`, `PROJECT_HANDOFF_2026-07-29.md`, `BULK_2000_PLAN.md`, and `RENDER_DEPLOYMENT_REQUIRED.md` first. Treat the repository, workflow results, Render production endpoints, and latest commits as the source of truth before describing project status.
