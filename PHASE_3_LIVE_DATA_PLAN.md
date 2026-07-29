# Next Year’s Monsters™ — Phase 3 Live Data Plan

<!-- TS: 2026-07-29 10:23 ET -->

## Goal

Turn the current 15-stock educational demonstration into an explainable research system covering approximately 2,000 active U.S.-listed common stocks.

Core experience:

**Enter a ticker → see the current price and Monster Rating™ → understand why → review verified news impact → see risks and catalysts → know what to watch next → inspect rating history and sources.**

## Non-negotiable rules

- Never expose market-data, news, database, or AI API keys in browser JavaScript.
- Never label delayed or partial-exchange data as full consolidated real-time data.
- Never fabricate a rating, headline, source, timestamp, or reason.
- Every rating must include a timestamp, scoring-version identifier, data-freshness status, reasons, risks, and source references.
- Every rating change must be stored with an explanation.
- Captain Breakout™ and the approved visual identity remain locked.
- The public site remains educational and does not recommend buying, selling, or holding a security.

## Honest definition of “real time”

The website can display live or near-live prices continuously while the Monster Rating™ updates on a controlled schedule and whenever material evidence changes.

Recommended cadence:

- Price, quote, and volume display: streaming or frequent snapshot updates.
- Intraday technical factors: recompute every 1–5 minutes.
- Monster Rating™: recompute every 5 minutes during market hours and immediately after a material news or filing event.
- Financial-statement factors: update when a new SEC filing is processed.
- News-impact factors: update when verified articles or company filings arrive.
- Historical backfill and quality checks: nightly.

This avoids recalculating 2,000 ratings on every individual trade while still delivering a current, responsive result.

## Proposed stock universe

Initial production universe:

- Approximately 2,000 active U.S.-listed operating-company common stocks.
- Prioritize liquid NYSE, Nasdaq, and NYSE American listings.
- Exclude ETFs, preferred shares, warrants, rights, units, shells, and inactive tickers by default.
- Handle ADRs, OTC securities, and special situations through explicit inclusion rules later.

The universe must be generated from provider reference data rather than maintained manually.

## System architecture

### 1. Existing front end

Keep the current GitHub Pages website as the public presentation layer during development.

Responsibilities:

- Ticker search and autocomplete.
- Monster Check™ result display.
- Rating history chart.
- News and source links.
- Clear timestamps and freshness labels.
- Friendly error and unavailable-data states.

GitHub Pages must never call licensed providers directly with secret credentials.

### 2. Secure backend API

Create a separate TypeScript backend service.

Responsibilities:

- Store provider credentials securely.
- Retrieve market data, news, reference data, and filings.
- Normalize provider responses.
- Run the Monster Rating™ scoring engine.
- Cache results.
- Save score history and explanation records.
- Return safe public JSON to the website.

Initial public endpoints:

- `GET /api/health`
- `GET /api/tickers?q=apple`
- `GET /api/monster-check/AAPL`
- `GET /api/ratings/AAPL/history`
- `GET /api/news/AAPL`
- `GET /api/sources/AAPL`

### 3. Provider adapter layer

Do not weld the project permanently to one vendor.

Create replaceable adapters:

- `MarketDataProvider`
- `NewsProvider`
- `FundamentalsProvider`
- `FilingsProvider`
- `ReferenceDataProvider`

The first implementation can use one commercial provider for market data and news, plus the SEC for official filings and XBRL facts. A second provider can be added later without rewriting the scoring engine or front end.

### 4. Database

Use PostgreSQL or an equivalent relational database.

Core tables:

- `tickers`
- `companies`
- `market_snapshots`
- `daily_bars`
- `intraday_bars`
- `fundamental_facts`
- `news_articles`
- `filings`
- `rating_components`
- `ratings`
- `rating_history`
- `rating_change_reasons`
- `source_records`
- `system_jobs`

Every stored rating should include:

- Ticker.
- Total score.
- Tier.
- Component scores.
- Positive evidence.
- Risk evidence.
- Raise conditions.
- Lower conditions.
- Watch-next items.
- Scoring-version identifier.
- Calculation timestamp.
- Oldest and newest source timestamps.
- Confidence and completeness flags.

## Monster Rating™ engine

The score must be explainable and versioned. Final weights will not be locked until calibration and backtesting are completed.

Initial evidence groups:

1. Business growth and acceleration.
2. Profitability, margins, and cash flow.
3. Financial strength and balance-sheet risk.
4. Relative strength, trend, and price structure.
5. Volume, accumulation, and institutional-behavior proxies.
6. Competitive position and durable Monster DNA™.
7. Verified catalysts and recent-news impact.
8. Valuation and expectations risk.
9. Company-specific, sector, and Market Weather™ risk.
10. Data-quality and freshness penalty.

Each component must produce:

- A numeric contribution.
- A plain-English explanation.
- Supporting source references.
- A timestamp.
- A confidence level.

## News and filing impact

The system must separate facts from interpretation.

For every material item, store:

- Headline or filing type.
- Publisher or SEC source.
- Original source link.
- Publication or filing time.
- Retrieval time.
- Tickers affected.
- Materiality level.
- Positive, negative, mixed, or neutral impact.
- Rating components affected.
- Plain-English explanation.
- Whether the total rating changed.

No article should affect a rating merely because generic sentiment software labeled it positive or negative.

## Rollout plan

### Stage 1 — Secure live-data foundation

- Add backend scaffold and environment configuration.
- Add provider interfaces.
- Connect one development market-data feed.
- Connect reference ticker lookup.
- Return current price data through the backend.
- Keep the existing 15 demonstration ratings unchanged during this stage.

Success test: the website obtains a current timestamped quote for the 15 existing tickers without exposing an API key.

### Stage 2 — Live 15-stock Monster Check™

- Replace static market fields with provider data.
- Add verified recent news and source links.
- Add SEC filing data.
- Implement Monster Rating™ version 1.
- Store rating history.
- Compare generated explanations with the book’s 15 VCL™ examples.

Success test: all 15 tickers produce timestamped, explainable, repeatable ratings from actual data.

### Stage 3 — Expand to 100 stocks

- Add automated universe management.
- Improve incomplete-data handling.
- Measure provider usage and backend cost.
- Validate scoring across sectors and company sizes.
- Add monitoring, retries, and stale-data warnings.

Success test: 100 stocks update reliably through a full trading week.

### Stage 4 — Expand to 500 stocks

- Add scheduled bulk updates.
- Optimize caching and database indexes.
- Add sector and peer-relative calculations.
- Add score-change alerts and history charts.
- Review false positives and unstable score behavior.

Success test: 500 stocks remain timely without excessive provider calls or unexplained rating swings.

### Stage 5 — Expand to approximately 2,000 stocks

- Activate the complete production universe.
- Add load testing and failure recovery.
- Add data-provider fallback rules.
- Complete market-data display and redistribution compliance review.
- Add accounts, watchlists, alerts, and paid tiers only after the core data is dependable.

Success test: users can search the full universe and receive a timestamped result with evidence, risks, verified sources, and rating history.

## Data licensing gate

The major non-code issue is permission to display market data publicly.

Development can begin with delayed data, a limited exchange feed, or provider sandbox access. Public consolidated real-time prices may require a business agreement and exchange redistribution permissions. Provider selection must be based on both technical capability and legal display rights.

## Immediate next work

1. Research and compare suitable market-data and news providers.
2. Choose the development provider and confirm display rights, coverage, rate limits, and cost.
3. Create the TypeScript backend scaffold.
4. Add `/api/health` and secure environment handling.
5. Add ticker search and quote endpoints for the existing 15 stocks.
6. Connect the current website to the backend without removing the demonstration fallback.
7. Document every commit and test result.

## Definition of Phase 3 success

Phase 3 is complete when the 15 existing VCL™ stocks display current timestamped market data, verified source-linked news, and a repeatable explainable Monster Rating™ produced by the backend, with no secret keys exposed and no demonstration content mislabeled as live.