# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 22:08 ET -->

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
5. The latest relevant files, workflow results, Render production status, commits, and open pull requests

Do not rely on prior chat memory as the source of truth. The repository, workflow results, and verified production endpoints are the source of truth.

## Current verified production status

- Render is live on backend version `0.6.0` with PostgreSQL, the SEC provider, and the bulk universe store configured.
- Production deployment commit is `5f90832376e736dfb46d29fcb4d1c88572740b0b`.
- The 500-company startup import completed successfully:
  - `requestedLimit: 500`
  - `importedCount: 500`
  - `universeSize: 514`
- The public 500-Stock Factory Status dashboard is live.
- Final verified 500-company totals on August 2, 2026:
  - 500 companies examined
  - 450 SEC complete
  - 50 SEC unresolved
  - 0 queued
  - 0 processing
  - 0 failed
  - 0 partial
  - 0 stale
  - 450 filing records complete
  - 400 company-fact records complete
  - 0 licensed quotes stored
  - 0 current Monster Ratings™ stored
- The final SEC totals reconcile exactly: `450 complete + 50 unresolved = 500`.
- GitHub Actions production smoke run `30777623553` passed against the live Render deployment.
- The SEC worker pool uses controlled concurrency `3` and now claims only concurrency-sized waves, preventing hundreds of records from being stranded as processing after a deployment interruption.
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
20. Repaired the abandoned-batch problem by processing SEC candidates in recoverable waves of three.
21. Manually deployed repaired commit `5f90832376e736dfb46d29fcb4d1c88572740b0b` to Render.
22. Final production validation passed with `450 SEC complete + 50 unresolved = 500`, `0 processing`, and `0 failed`.
23. Production smoke run `30777623553` passed.
24. Draft pull request `#29`, titled `Prepare controlled 2,000-company SEC capacity`, passed:
    - Phase 3 Backend Checks run `30777842862`
    - Static site checks run `30777842865`
25. Pull request `#29` remains draft and unmerged, so the live Render limits remain at 500.

## Immediate next work: controlled move from 500 to 2,000

1. Treat the 500-company milestone as complete and do not rerun it unnecessarily.
2. Review draft pull request `#29` and confirm its branch is current with `main` before merging.
3. Merge only the tested 2,000-capability support first; do not immediately change every Render limit in the same step.
4. Use a staged rollout:
   - Phase A: import the 2,000-company universe without starting a full SEC batch in the same deployment.
   - Phase B: verify the database universe size and the first 2,000 examined records.
   - Phase C: enable SEC processing for 2,000 with concurrency `3` and recoverable wave claims.
   - Phase D: monitor until `processingCount: 0`, `failedCount: 0`, and `secCompleteCount + unresolvedCount = 2000`.
   - Phase E: run the production smoke test and record the final 2,000-company totals.
   - Phase F: disable one-time startup import and batch bootstrap settings after successful completion so future deployments do not rerun the whole load.
5. Do not create individual stock profile pages during the 2,000-company scale test.
6. Keep SEC evidence, unresolved identities, quotes, ratings, and VCL™ demonstrations plainly separated on the public dashboard.
7. Before producing current Monster Ratings™, connect a licensed quote provider and a versioned production scoring engine.

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

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md`, `PROJECT_HANDOFF_2026-07-29.md`, `BULK_2000_PLAN.md`, and `RENDER_DEPLOYMENT_REQUIRED.md` first. Treat the repository, workflow results, Render production endpoints, latest commits, and open pull requests as the source of truth. The 500-company SEC milestone is complete at 450 SEC complete, 50 unresolved, 0 processing, and 0 failed. The next phase is the controlled 500-to-2,000 rollout. Review draft pull request #29 before changing Render production limits.
