# START HERE — Next Year’s Monsters™ Website

<!-- TS: 2026-08-02 15:55 ET -->

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
5. The latest relevant files, issues, workflow results, and commits in the repository

Do not rely on prior chat memory as the source of truth. The repository, workflow results, and handoff files are the source of truth.

## Current verified project status

- The static website, Monster Check™ demonstration, VCL™ Library, verification ledger, market tools, and approved Captain Breakout™ branding are committed.
- The 15 original VCL™ companies remain the demonstration/pilot set. They are not represented as a freshly verified live ranking of today’s top 15 stocks.
- `MARKET_DATA_PROVIDER` remains deliberately set to `unconfigured`; no licensed live or delayed quote provider is currently connected.
- New stock coverage must use the bulk pipeline in `BULK_2000_PLAN.md`, not handcrafted pages.
- Backend source version `0.6.0` contains:
  - the official SEC universe parser
  - the transactional bulk importer
  - the `company_pipeline_status` table
  - queued, processing, complete, partial, failed, and stale states
  - retry times, attempt counts, last errors, and abandoned-job recovery
  - controlled-concurrency SEC worker processing
  - `/api/universe/status` for up to 2,500 companies
- Render configuration in the repository requests:
  - 100-company automatic import
  - 100-company SEC evidence batch
  - concurrency `3`
  - 24-hour stale threshold
  - PostgreSQL migration and verification before deployment
- `factory-status.html` is the public 100-Stock Factory Status page. It shows summary counts, progress, evidence coverage, attempts, retry times, timestamps, and errors.
- The factory page checks `/api/health` first and explicitly reports when Render is still serving an old backend instead of displaying misleading zeroes.
- A production smoke workflow now checks Render, the 100-company database, pipeline-state reconciliation, and the deployed factory page.

## Completed and validated on August 2, 2026

1. Reordered and color-coded the 15-stock VCL™ table.
2. Reduced oversized and cramped live-data board typography.
3. Added the 15-stock verification ledger and production provider-health cards.
4. Added automated static-site validation.
5. Added the guarded pilot SEC refresh.
6. Added the bulk 2,000-stock implementation plan.
7. Added the SEC universe parser and transactional 100-company importer.
8. Added the bulk universe status endpoint for up to 2,500 companies.
9. Added the retry-safe SEC pipeline table, queue, worker pool, manual command, and startup batch.
10. Added failure-isolation tests proving one company does not stop successful companies.
11. Added the public 100-Stock Factory Status page and site-wide navigation link.
12. Added production smoke testing from GitHub Actions.
13. Bulk-universe validation passed:
    - Phase 3 Backend Checks run `30761148428`
    - Static site checks run `30761148461`
14. SEC batch-factory validation passed:
    - Phase 3 Backend Checks run `30761443871`
    - Static site checks run `30761443883`
15. Factory dashboard validation passed:
    - Phase 3 Backend Checks run `30761660242`
    - Static site checks run `30761660234`

## Confirmed production blocker

Production smoke run `30761741073` queried the live Render service 10 times over approximately five minutes.

Every request returned:

- live API version `0.3.0`
- expected source version `0.6.0`
- production database not configured
- bulk universe store not configured

This proves the live Render service has not deployed current `main` or synchronized the current Blueprint configuration. The GitHub factory code and tests are not the current blocker.

The deployment blocker is tracked in GitHub issue `#13` and documented in `RENDER_DEPLOYMENT_REQUIRED.md`.

## Immediate next work

1. In Render, synchronize the Blueprint or reconnect the service to the correct repository, branch, and `backend` root directory.
2. Add `SEC_USER_AGENT` manually in Render because `sync: false` values are not populated by later Blueprint updates.
3. Confirm `DATABASE_URL` is linked to `next-years-monsters-db`.
4. Use **Save, rebuild, and deploy**, then **Manual Deploy → Deploy latest commit**. Do not merely restart the old service.
5. Confirm `/api/health` reports version `0.6.0` and configured database, SEC, and universe providers.
6. Confirm `/api/universe/status?limit=100` returns at least 100 companies and reconciled pipeline counts.
7. Re-run the production smoke workflow until it passes.
8. Only after the 100-company production run is proven, increase the same pipeline to 500 and then 2,000.
9. Connect a licensed quote provider before producing current Monster Ratings™.

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

> Continue the Next Year’s Monsters™ website from the GitHub repository `Poppoparazzi/-TS-2026-07-28-22-35-ET-next-years-monsters-website`. Read `START_HERE.md`, `PROJECT_HANDOFF_2026-07-29.md`, `BULK_2000_PLAN.md`, and `RENDER_DEPLOYMENT_REQUIRED.md` first. Treat the repository, GitHub issue #13, and workflow results as the source of truth before describing project status.
