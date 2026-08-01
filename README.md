<!-- TS: 2026-08-01 14:37 ET -->
# Next Year’s Monsters™ Website

Live website: [https://nextyearsmonsters.com](https://nextyearsmonsters.com)

This repository contains the public GitHub Pages website and the provider-neutral TypeScript backend prepared for the secure live-data phase.

## Public experience

The live site includes the editorial landing page, Monster Check™, Top Monsters, Stock Directory, Full Charts, Market Pulse, News Radar, the Visual Case Library, and the Live Data Rollout Board.

## What works now

- Responsive editorial website at the production domain.
- Search and detailed educational Monster Checks for all 15 VCL companies.
- External chart and news coverage across the current 25-stock market universe.
- Clearly labeled illustrative demo scores.
- Approved Captain Breakout™ artwork displayed without cropping or substitution.
- GitHub Pages deployment with apex and `www` routing and HTTPS.
- Secure backend scaffold for provider quotes, SEC filings and facts, PostgreSQL readiness, and demonstration fallback behavior.
- Automated backend typechecking and tests.

## Production work remaining

- Deploy the SEC-first backend and configure its SEC contact header.
- Connect PostgreSQL after the first official filing path is verified.
- Choose a market-data provider and plan whose license permits public display before connecting quotes.
- Connect the verified public API address in `assets/runtime-config.js`.
- Save the first genuine quote and SEC status records.
- Implement and calibrate Monster Rating™ Version 1 before labeling any rating as live.
- Select a news provider whose public-display and redistribution rights are approved.
- Add accounts, subscriptions, watchlists, and alerts only after the core live-data path is dependable.

Until those milestones pass, the site keeps educational ratings clearly labeled as demonstrations and never substitutes invented live data.

## Preview locally

Because the site loads `data/stocks.json`, start a small local server from this folder.

Windows PowerShell:

    python -m http.server 8000

Then open:

    http://localhost:8000

## Deployment

GitHub Pages publishes `main` from `/ (root)`. The repository `CNAME` file connects the live domain. The backend deployment blueprint is `render.yaml`; private values must be configured only on the backend host and must never be committed to this repository.
