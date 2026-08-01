# Next Year’s Monsters™ — Phase 3 Provider Decision

<!-- TS: 2026-08-01 17:48 ET -->

## Decision

Use a replaceable provider architecture rather than tying Monster Rating™ to one vendor.

### Public market display — revised August 1, 2026

Use **TradingView's free hosted widgets** for visible public price and chart context. The widgets include their own data and branding; availability can be real-time, delayed, or end-of-day depending on the market. This matches a one-year research product without purchasing unnecessary low-latency exchange data.

Keep the provider-neutral backend quote adapter, batch endpoint, cache, timestamps, and failure handling ready, but leave the raw quote provider unconfigured in production until an external-display license is selected deliberately.

### Private development adapter

**Twelve Data** remains a supported private-development adapter for ticker reference data and timestamped quote experiments. It is not approved as the public display source under an individual/internal/non-display plan.

Reasons:

- It covers listed U.S. equities and offers REST and WebSocket access.
- Its credit model is documented clearly enough to estimate early development usage.
- It supports real-time U.S. equity data without placing a provider key in browser JavaScript.
- It provides a useful way to validate the provider-neutral interface without embedding a key in the browser.

Important limitation:

Twelve Data states that its default real-time U.S. feed is sourced from venues that do not require additional exchange licensing and represents only a portion of total U.S. trading volume. The site must therefore label the feed accurately. It must not call this a full consolidated SIP quote unless a licensed consolidated product is purchased.

External display rights must be confirmed before enabling it publicly. Personal, internal, or non-display plans are not permission to redistribute raw data to website visitors, and a 25-symbol request consumes per-symbol credits even when submitted as one batch.

### Official filings and reported financial facts

Use the **SEC data.sec.gov APIs and nightly bulk archives** for:

- Filing history.
- 10-K, 10-Q, 8-K, and related filing records.
- XBRL company facts.
- Official source links and filing timestamps.

The SEC APIs require no API key, but the backend must use a declared user agent, caching, and fair-access throttling below the SEC’s published maximum request rate.

### News provider

Keep the news layer replaceable.

Initial candidates:

1. **Finnhub** for company news during private development.
2. **Financial Modeling Prep** for a combined commercial news, fundamentals, and market-data option.

Neither provider should be used for unrestricted public display until its commercial or redistribution terms are confirmed in writing. FMP explicitly states that display and redistribution require a specific agreement. Finnhub’s listed self-service plans are described as personal-use plans.

### Enterprise alternative

**Polygon/Massive** remains an enterprise-quality alternative for broad U.S. exchange coverage, REST, WebSockets, historical data, and news. It should be reconsidered if the project needs consolidated feeds, larger-scale tick data, or a different commercial license.

## Phase 3 development stack

- Front end: existing GitHub Pages website.
- Backend: Node.js + TypeScript + Fastify.
- Public charts and price context: TradingView hosted widgets.
- Private raw market-data adapter: Twelve Data supported but production-unconfigured pending display rights.
- Filings adapter: SEC data.sec.gov.
- News adapter: unconfigured until development credentials and display terms are approved.
- Database: PostgreSQL in the next backend milestone.
- Cache: provider-response caching added before the 100-stock expansion.

## Labeling rules

Every market response must expose:

- Provider name.
- Quote timestamp.
- Retrieval timestamp.
- Market session.
- Delay or feed-scope label.
- Stale-data status.

Every news response must expose:

- Publisher.
- Original URL.
- Publication timestamp.
- Retrieval timestamp.
- A factual summary separated from Monster Rating™ interpretation.

## Immediate implementation order

1. Commit the provider-neutral TypeScript backend scaffold.
2. Add `GET /api/health`.
3. Add secure environment-variable handling.
4. Add a `MarketDataProvider` interface.
5. Retain the Twelve Data adapter without committing a real API key.
6. Publish the cached single-quote and 25-symbol batch endpoints.
7. Keep TradingView widgets on the public website while retaining the demonstration fallback.
8. Extend the SEC adapter with verified issuer-continuity handling.
9. Select and license raw market data or news only when the product requires capabilities the public widgets and SEC cannot provide.

## Approval gate before public live data

Before the website describes prices as publicly displayed live data, confirm:

- Commercial use is permitted.
- External display is permitted.
- Attribution requirements are satisfied.
- Exchange or consolidated-feed limitations are disclosed.
- Caching and retention rules are satisfied.
- The plan can support the expected number of users and approximately 2,000 stocks.
