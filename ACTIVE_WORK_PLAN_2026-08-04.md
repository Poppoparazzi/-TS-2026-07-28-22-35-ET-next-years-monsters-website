# Next Year’s Monsters™ — Parallel Work Plan

<!-- TS: 2026-08-04 07:30 ET -->

## Operating rule

A blocked deployment lane does not stop independent website work. Render deployment monitoring and website development proceed separately.

## Lane A — Production deployment and 2,300-candidate sync

Owner: Render, GitHub, and the hourly Monster Deploy Watch.

Current objective:

1. Verify Render deploys merged commit `502f44a424b2bcfa01ede442641f4f7567ec3001` or a later commit containing the same repair.
2. Verify `AUTO_IMPORT_UNIVERSE_LIMIT=2300`.
3. Verify `AUTO_SEC_BATCH_SIZE=2300`.
4. Keep `SEC_BATCH_CONCURRENCY=3`.
5. Verify the active candidate universe reaches 2,300.
6. Verify the public 2,000 contains 2,000 SEC-complete companies.
7. Report exact complete, unresolved, queued, processing, and failed counts.

Schedule:

- Automated read-only check: hourly.
- Manual intervention: only when the monitor reports a deployment failure, stalled batch, incorrect environment values, or completed processing.
- No unnecessary restart while a healthy SEC batch is active.

## Lane B — Website build work

Owner: active ChatGPT/GitHub development sessions.

### Work block 1 — 7:30–8:15 AM ET

- Rewrite `start-here.html` around the expanded 2,000-stock experience.
- Add clear paths to Coverage, Factory Status, Monster Check™, Full Charts, Market Pulse, News Radar, Verification, and Data Status.
- Add a plain-English live/delayed/demo/unresolved/not-yet-rated label guide.

### Work block 2 — 8:15–8:35 AM ET

- Run static-site validation.
- Correct broken links, stale 500-stock wording, or missing navigation hooks.
- Open a focused pull request that does not change Render startup settings.

### Work block 3 — After the first pull request passes

- Audit data-status wording across the homepage, Monster Check™, Top Monsters, Factory Status, Coverage, and Data Status pages.
- Standardize these labels:
  - Official SEC evidence
  - External market data — may be delayed
  - Demonstration rating
  - Not yet rated
  - Unresolved SEC identity
  - Provider not connected

### Work block 4 — Next independent backend branch

- Define the market-data-provider interface without selecting or fabricating a provider.
- Define the versioned Monster Rating™ input/output contract.
- Keep quote storage and production ratings disabled until licensed data and the scoring formula are approved.

## Reporting rule

Every active build block must end with one of the following:

- a commit,
- a pull request,
- a passing or failing automated test with the exact failure,
- or a clearly named blocker with the next required action.

No block ends with “still monitoring” as its only result.
