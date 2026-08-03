# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 21:22 ET -->

This file is the permanent starting point for every future ChatGPT or Codex session working on this website.

## Repository

`Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`

## Live sites and production endpoints

- Website: `https://nextyearsmonsters.com/`
- Factory dashboard: `https://nextyearsmonsters.com/factory-status.html`
- Render API: `https://next-years-monsters-api.onrender.com`
- Startup status: `https://next-years-monsters-api.onrender.com/api/startup-status`
- Universe status: `https://next-years-monsters-api.onrender.com/api/universe/status?limit=500`

## First instruction for every new chat

Open and read these files before making any changes:

1. `START_HERE.md`
2. `PROJECT_HANDOFF_2026-07-29.md`
3. `BULK_2000_PLAN.md`
4. `RENDER_DEPLOYMENT_REQUIRED.md`
5. The latest relevant files, workflow results, Render production status, and commits

Do not rely on prior chat memory as the source of truth. The repository, workflow results, and verified production endpoints are the source of truth.

## Current verified production status

- Render is live on backend version `0.6.0` with PostgreSQL, the SEC provider, and the bulk universe store configured.
- Production deployment commit begins `dd29db5`.
- The 500-company startup import completed successfully:
  - `requestedLimit: 500`
  - `importedCount: 500`
  - `universeSize: 514`
- The public 500-Stock Factory Status dashboard is live.
- At the last verified production check on August 2, 2026:
  - 500 companies examined
  - 238 SEC complete
  - 237 still in the claimed batch
  - 25 SEC unresolved
  - 0 retry failures
  - 0 stale
  - 238 filing records complete
  - 212 company-fact records complete
  - 0 licensed quotes stored
  - 0 current Monster Ratings™ stored
- The pipeline totals reconciled correctly: `238 complete + 237 in batch + 25 unresolved = 500`.
- The SEC worker pool uses controlled concurrency `3`. Records labeled `processing` are now displayed publicly as `IN BATCH`; they are not all simultaneous SEC connections.
- The factory dashboard refreshes automatically every minute.
- Permanent SEC HTTP 404 results are labeled `unresolved` and excluded from endless retries.
- Temporary failures retain retry times and do not stop other companies.
- `MARKET_DATA_PROVIDER` remains deliberately `unconfigured`; no licensed live or delayed quote provider is connected.
- The original 15 VCL™ companies remain clearly labeled demonstration/pilot examples, not a current verified Top 15 ranking.

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
14. Proved the first 100-company production run.
15. Added the permanent unresolved SEC state.
16. Increased the importer and SEC batch limits from 100 to 500.
17. Deployed and verified the 500-company production import.
18. Upgraded the public dashboard and navigation to 500 stocks.
19. Clarified the public processing label to `IN BATCH` and documented concurrency `3`.
20. Final 500-stock backend validation passed:
    - Phase 3 Backend Checks run `30767428224`
    - Static site checks run `30767428219`
21. Final 500-stock dashboard validation passed:
    - Static site checks run `30767626605`

## Immediate next work

1. Let the existing 500-company SEC batch finish without starting another deployment or restart.
2. Recheck `/api/universe/status?limit=500` and confirm:
   - `processingCount: 0`
   - `failedCount: 0`
   - `secCompleteCount + unresolvedCount = 500`
3. Run the production smoke workflow against the completed 500-company state.
4. Update this file with the final 500-company completion totals.
5. Then prepare the same bulk pipeline for 2,000 companies without creating individual stock pages.
6. Before producing current Monster Ratings™, connect a licensed quote provider and a versioned production scoring engine.
7. Continue improving the public dashboard so batch progress, unresolved identities, SEC evidence, quotes, and ratings remain plainly separated.

## Locked design and data rules

- Preserve the approved cream, black, red, gold, and lime editorial design.
- Keep Captain Breakout™ exactly as approved and use `object-fit: contain` where appropriate.
- The screen finds evidence; it does not promise winners.
- Use clearly labeled demonstration data until licensed APIs and the production scoring engine are connected and verified.
- Do not claim the 15 VCL™ companies are the current Top 15 unless the current scoring process has actually verified and ranked them.
- No handcrafted profile page may be created for each new stock during the 500 or 2,000-company scale tests.
- Permanent SEC 404 records must remain clearly labeled unresolved and must not be treated as current verified SEC coverage.
- Use only the approved TuneTank bull-mad-mooing WAV later if the bull sound is added.

## Recovery rule

If a ChatGPT conversation disappears, open a new chat and paste this instruction:

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md`, `PROJECT_HANDOFF_2026-07-29.md`, `BULK_2000_PLAN.md`, and `RENDER_DEPLOYMENT_REQUIRED.md` first. Treat the repository, workflow results, Render production endpoints, and latest commits as the source of truth. The 500-company import is already live and verified; first check whether the remaining SEC batch has finished before making any deployment or scaling changes.
