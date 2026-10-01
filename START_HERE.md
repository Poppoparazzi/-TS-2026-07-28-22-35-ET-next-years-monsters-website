# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-10-01 07:25 ET -->

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
5. `CONTROLLED_2000_ROLLOUT.md`
6. `MONSTER_DNA_V2.md`
7. `data/monster-dna-v2-policy.json`
8. `data/monster-dna-v2-forward-test.json`
9. The latest relevant files, workflow results, Render production status, commits, and open pull requests

Do not rely on prior chat memory as the source of truth. The repository, workflow results, and verified production endpoints are the source of truth.

## October 1, 2026 methodology reset — Monster DNA V2

- The August 8, 2026 Monster Hunt scores are frozen historical records. Never rewrite them after seeing subsequent returns.
- The first retrospective check showed that a high fingerprint score alone did not reliably predict the next stock move. CRDO at 94 is the key stress-test failure; strong later winners also appeared lower in the original Top 15.
- Version 2 deliberately studies both sides of the historical sample: what pre-breakout winners had **and what similar non-winners lacked or carried as negative evidence**.
- Version 2 has three independent pillars: Business DNA (40%), Inflection & Expectations (35%), and Market Confirmation (25%), followed by explicit Anti-DNA penalties.
- A weighted average cannot hide a failed pillar. Active Monster status requires an adjusted score of at least 80 plus every hard gate in `data/monster-dna-v2-policy.json`.
- The next cohort must be frozen prospectively before outcomes are measured. The 60-day checkpoint is diagnostic only; the 90-day checkpoint is the primary evaluation.
- A primary 90-day hit requires both a positive stock return and outperformance versus SPY over the same interval.
- The research target is at least 75% primary hits (12 of 15), but this is a validation target, not a promise. Do not claim reliable predictive power until at least three frozen prospective cohorts / 45 candidates have completed without post-hoc rule changes.
- Version 2 is not yet wired into production rating generation. The policy and hard-gate evaluator are being implemented on branch `feature/monster-dna-v2-forward-test-20261001` before any public score is changed.


## Current verified production status

- Render is live on backend version `0.6.0` with PostgreSQL, the SEC provider, and the bulk universe store configured.
- Last verified live production deployment commit is `5f90832376e736dfb46d29fcb4d1c88572740b0b`.
- Repository `main` includes the tested 2,000-company capability support at commit `f6335aa9af799f080c39be2bd110ab6bd9b4bd7b`, but the live production limits remain at 500 until the separate Phase A rollout is deliberately deployed and verified.
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
- The SEC worker pool uses controlled concurrency `3` and claims only concurrency-sized waves, preventing hundreds of records from being stranded as processing after a deployment interruption.
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
24. Rebuilt the 2,000-company capability branch directly on the final 500-company baseline.
25. Pull request `#30`, titled `Prepare controlled 2,000-company SEC capacity on final 500 baseline`, passed:
    - Phase 3 Backend Checks run `30778845540`
    - Static site checks run `30778845570`
26. Pull request `#30` merged as commit `f6335aa9af799f080c39be2bd110ab6bd9b4bd7b`.
27. Obsolete draft pull request `#29` was closed without merging.
28. The merged capability support raises accepted SEC batch targets to 2,500 while leaving `render.yaml`, the live limit, dashboard limit, and production smoke expectation at 500.

## Immediate next work: controlled move from 500 to 2,000

1. Treat the 500-company milestone as complete and do not rerun it unnecessarily.
2. Do not confuse merged 2,000-company capability with a completed 2,000-company production import. Production remains verified at 500.
3. Start Phase A on a separate rollout branch:
   - set `AUTO_IMPORT_UNIVERSE_LIMIT=2000`
   - set `AUTO_SEC_BATCH_SIZE=0`
   - keep `SEC_BATCH_CONCURRENCY=3`
   - keep `MARKET_DATA_PROVIDER=unconfigured`
   - do not change the public dashboard to claim 2,000 until the import is verified
4. Deploy Phase A once and verify:
   - `universeSize >= 2000`
   - `/api/universe/status?limit=2000` examines 2,000 records
   - the completed original 500 remain terminal
   - newly imported records are queued
   - no SEC processing wave starts
   - quotes and ratings remain zero
5. Only after Phase A passes, prepare Phase B to enable SEC processing for 2,000 with concurrency `3` and recoverable wave claims.
6. Monitor Phase B until `processingCount: 0`, `failedCount: 0`, `queuedCount: 0`, and `secCompleteCount + unresolvedCount = 2000`.
7. Run the production smoke test against the final 2,000-company state and record the exact totals.
8. Disable one-time startup import and batch bootstrap settings after successful completion so future deployments do not rerun the whole load.
9. Do not create individual stock profile pages during the 2,000-company scale test.
10. Keep SEC evidence, unresolved identities, quotes, ratings, and VCL™ demonstrations plainly separated on the public dashboard.
11. Before producing current Monster Ratings™, connect a licensed quote provider and a versioned production scoring engine.

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

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md`, `PROJECT_HANDOFF_2026-07-29.md`, `BULK_2000_PLAN.md`, `RENDER_DEPLOYMENT_REQUIRED.md`, and `CONTROLLED_2000_ROLLOUT.md` first. Treat the repository, workflow results, Render production endpoints, latest commits, and open pull requests as the source of truth. The 500-company SEC milestone is complete at 450 SEC complete, 50 unresolved, 0 processing, and 0 failed. The tested 2,000-company capability support merged as commit `f6335aa9af799f080c39be2bd110ab6bd9b4bd7b`, but the live production limits remain at 500. The next step is Phase A: import 2,000 companies with SEC batch processing disabled, then verify the database before enabling Phase B processing.
