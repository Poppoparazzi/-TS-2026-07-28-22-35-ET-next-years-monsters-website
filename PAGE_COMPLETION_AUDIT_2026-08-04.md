# Next Year’s Monsters™ — Public Page Completion Audit

<!-- TS: 2026-08-05 06:36 UTC -->

## Completion rule

A public page is not complete merely because it loads. It is complete only when:

1. every visible promise matches a capability that works now;
2. external, delayed, demonstration, unresolved, and unavailable data are labeled correctly;
3. no obsolete rollout language remains;
4. no empty “coming soon” section occupies public space;
5. links, forms, widgets, mobile layout, and failure states are tested;
6. the page gives the visitor a useful next action;
7. automated static checks pass.

When a promised capability cannot yet be delivered because a licensed provider or approved scoring formula is missing, the public page must either present the honest current substitute or remove the promotional promise until the capability exists.

## Page-by-page register

| Priority | Page | Current verdict | Promise or problem found | Finished when |
|---|---|---|---|---|
| P0 | `index.html` | PARTIAL / STALE | Says the directory searches 25 companies while the SEC factory is approaching a public 2,000; describes the site as searchable, updated, and historically accountable although production ratings and history are not connected. | Search routes correctly to current coverage; public factory status is visible; 25-stock external tools are separated from 2,000-company SEC coverage; no unsupported “updated” or history implication remains; all main calls to action work. |
| P0 | `start-here.html` | COMPLETE — PR #42 | Reconciled with the later page repairs. All six approved labels are defined exactly; stale rollout, future-rating, live-news, and invented-zero implications are removed; current Coverage, Monster Check™, Factory Status, Top Monsters, charts, Market Pulse, News Radar, Verification, and VCL™ routes are explained without unsupported claims. | Completed in commit `28df3af591147461e80c92bc71466e66b6b2941c`. All referenced public routes were verified, the page has no form or page-specific JavaScript requiring API-failure simulation, and responsive behavior was checked at 900px, 800px, and 560px. GitHub Actions did not register a PR workflow run for that commit; no test failure was reported. |
| P0 | `monster-check.html` | PARTIAL | Exact SEC ticker lookup and 15 demonstrations work, but the public roadmap advertises live market data, verified news impact, and rating history that do not exist. | Exact ticker flow, SEC identity, filing links, demo labels, chart links, failure states, and mobile layout pass; unsupported roadmap promises are removed from public space or replaced by working current capabilities. |
| P0 | `top-monsters.html` | SERIOUSLY STALE | Still says 0/15 SEC checks, secure backend not deployed, and “next milestone 1/15”; Rising Stars is an empty future section. | Reads current production evidence status; distinguishes 15 demos from public SEC coverage; removes obsolete rollout milestones; hides Rising Stars until dated production rating history exists; leaderboard actions work. |
| P0 | `coverage-universe.html` | SERIOUSLY STALE | Calls itself a 25-stock directory and says 2,000-stock coverage is planned and not built. | Searches the production public company universe; clearly separates the external Market 25 from SEC-covered companies; provides filters for SEC complete, unresolved, demo available, chart available, and not yet rated; no obsolete 25-only or “2,000 planned” language remains. |
| P0 | `factory-status.html` | FUNCTIONAL / DEPLOYMENT VERIFICATION REQUIRED | Public 2,000 dashboard code is merged, but live Render deployment and final reserve-pool counts require verification. | Live page reports the deployed backend, 2,000 requested records, exact queue/processing/complete/unresolved/failure totals, useful failure messages, and correct navigation. |
| P0 | `live-status.html` | REPAIR READY IN PR #43 | Main still says database not connected and describes the obsolete 1→5→10→15→25 rollout. | PR #43 is reconciled and validated; page reads health and public factory counts; statements match production; external charts, quotes, SEC evidence, demos, and ratings are clearly separated. |
| P1 | `market-explorer.html` | MOSTLY FUNCTIONAL | Exact SEC verification and external charts work, but the page needs live-browser checks, custom-domain-safe links, clearer 2,000 coverage routing, and stronger widget timeout/fallback behavior. | Exact ticker and comparison modes work on desktop/mobile; blank or blocked widgets show source links; no hard-coded obsolete host remains; SEC verification and delayed-chart labels are accurate. |
| P1 | `market-pulse.html` | PARTIAL | External TradingView tools work in principle, but links use an old GitHub Pages address, wording is fixed to Market 25, and widget load failure handling is limited. | Uses current-site links; widgets have timeout and direct-source fallback; external Market 25 is clearly separated from public SEC coverage; no stale coverage implication remains. |
| P1 | `news-radar.html` | PARTIAL | Provides external TradingView stories for Market 25 only; does not store, verify, timestamp-normalize, deduplicate, classify, or score news internally. | Current external scope is explicit; blank/blocked feed has useful source fallback; selected ticker and source link work; timestamps and provider limitations are explained; unsupported rating-impact promises are absent until an internal provider exists. |
| P1 | `verification-ledger.html` | FUNCTIONAL / NEEDS RECHECK | Useful 15-stock verification ledger exists, but current production results and failure handling need browser verification after the larger SEC rollout. | All 15 rows reconcile with API data; no demo is presented as a production rating; retry/error states are readable; counts and timestamps are accurate. |
| P1 | `how-it-works.html` | STALE PROTOTYPE | Says the system retrieves all data required for a rating and assigns a 0–100 score as though production scoring is live. Visual design and navigation are also from the older prototype. | Rewritten around what works today; separates SEC evidence, external market context, VCL demonstrations, and future versioned ratings; matches current editorial navigation and mobile design. |
| P1 | `vcl-library.html` | PARTIAL / BRAND CONFLICT | Static 15-stock demo table works, but it promises future production VCL pages and uses tier bands that may conflict with approved publication tiers. | Approved tier definitions are reconciled; every ticker opens its Check and available case/chart; future-only notice is removed or replaced by available VCL material; navigation and styling match the current site. |
| P1 | `about.html` | SERIOUSLY STALE | Calls the site a prototype, says only five pages were rebuilt, and describes a future app plan rather than the current product. | Explains the current book companion and research site honestly; removes obsolete stats; presents the author/project/mascot accurately; links to Start Here, system, verification, and data status. |

## Cross-site completion tasks

1. Discover every additional public `.html` file not listed above and add it to this register.
2. Search all public HTML and JavaScript for: `coming soon`, `will`, `planned`, `not yet built`, `first test`, `prototype`, `future`, `next milestone`, stale stock counts, and obsolete deployment claims.
3. Standardize the six public labels:
   - Official SEC Evidence
   - External Market Data · May Be Delayed
   - Demonstration Rating
   - Not Yet Rated
   - Unresolved SEC Identity
   - Provider Not Connected
4. Run local-link, JavaScript syntax, static-site, desktop, mobile, empty-state, API-failure, and blocked-widget checks.
5. Do not mark the site complete until every page row is `COMPLETE` or intentionally removed from public navigation.

## Work order

1. Finish PR #42: Start Here.
2. Finish PR #43: Data Status.
3. Repair Coverage.
4. Repair Top Monsters.
5. Repair Monster Check public promises.
6. Audit and repair Homepage.
7. Repair News Radar.
8. Repair Market Pulse.
9. Validate Market Explorer.
10. Validate Factory Status and Verification Ledger.
11. Rewrite How It Works.
12. Reconcile VCL Library tiers and links.
13. Rewrite About.
14. Complete cross-site promise scan and final browser audit.

Each page repair must have its own focused commit or pull request, an exact test result, and an update to this audit register.