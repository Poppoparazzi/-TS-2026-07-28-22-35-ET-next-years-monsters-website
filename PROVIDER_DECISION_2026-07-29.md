# Next Year’s Monsters™ — Phase 3 Provider Decision

<!-- TS: 2026-07-29 10:36 ET -->

## Decision

Use a replaceable provider architecture rather than tying Monster Rating™ to one vendor.

### Development market-data provider

**Twelve Data** is the recommended first development provider for ticker reference data, timestamped U.S. quotes, historical bars, technical inputs, and WebSocket experiments.

Reasons:

- It covers listed U.S. equities and offers REST and WebSocket access.
- Its credit model is documented clearly enough to estimate early development usage.
- It supports real-time U.S. equity data without placing a provider key in browser JavaScript.
- It provides a practical path from the current 15-stock test to 100, 500, and approximately 2,000 symbols.

Important limitation:

Twelve Data states that its default real-time U.S. feed is sourced from venues that do not require additional exchange licensing and represents only a portion of total U.S. trading volume. The site must therefore label the feed accurately. It must not call this a full consolidated SIP quote unless a licensed consolidated product is purchased.

External display rights must be confirmed before public launch. Personal or internal-use plans are not automatically permission to redistribute data to website visitors.

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
- Market-data adapter: Twelve Data first.
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
5. Add a Twelve Data adapter without committing a real API key.
6. Add ticker lookup and current quote endpoints for the original 15 stocks.
7. Connect the website to the backend while retaining the demonstration fallback.
8. Add the SEC filings adapter.
9. Select and license the production news provider.

## Approval gate before public live data

Before the website describes prices as publicly displayed live data, confirm:

- Commercial use is permitted.
- External display is permitted.
- Attribution requirements are satisfied.
- Exchange or consolidated-feed limitations are disclosed.
- Caching and retention rules are satisfied.
- The plan can support the expected number of users and approximately 2,000 stocks.
