// TS: 2026-08-01 21:19 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type {
  PersistenceStore,
  StoredCompanySnapshot,
} from "../src/database/persistence.js";
import { UnconfiguredMarketDataProvider } from "../src/providers/unconfigured.js";
import type {
  MarketDataProvider,
  QuoteSnapshot,
  TickerSearchResult,
} from "../src/providers/types.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecFilingSummary,
} from "../src/sec/types.js";

const TEST_SECRET = "test-secret-that-must-never-appear";

function testConfig(): AppConfig {
  return Object.freeze({
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 8787,
    corsOrigins: Object.freeze(["https://example.test"]),
    marketDataProvider: "twelve-data",
    twelveDataApiKey: TEST_SECRET,
    secUserAgent: "NextYearsMonsters test@example.test",
    databaseUrl: null,
  });
}

class StaticMarketDataProvider implements MarketDataProvider {
  public readonly name = "static-test-provider";
  public readonly configured = true;
  public quoteCalls = 0;

  public constructor(private readonly failingSymbols = new Set<string>()) {}

  public async searchTickers(
    query: string,
    limit = 10,
  ): Promise<readonly TickerSearchResult[]> {
    return [
      {
        symbol: query.trim().toUpperCase(),
        companyName: "Test Company",
        exchange: "NASDAQ",
        securityType: "Common Stock",
        active: true,
      },
    ].slice(0, limit);
  }

  public async getQuote(symbol: string): Promise<QuoteSnapshot> {
    this.quoteCalls += 1;
    if (this.failingSymbols.has(symbol)) {
      throw new Error(`Test-only failure for ${symbol}.`);
    }
    return {
      symbol,
      companyName: "Test Company",
      exchange: "NASDAQ",
      currency: "USD",
      price: 123.45,
      change: 1.25,
      percentChange: 1.02,
      volume: 1_000_000,
      marketSession: "regular",
      freshness: "near-live",
      provider: this.name,
      providerTimestamp: "2026-07-29T15:45:00.000Z",
      retrievedAt: "2026-07-29T15:45:01.000Z",
      feedDisclosure: "Test feed disclosure.",
    };
  }
}

class MemoryPersistenceStore implements PersistenceStore {
  public readonly name = "memory-test-database";
  public readonly configured = true;
  public quoteSaves = 0;
  private readonly snapshots = new Map<string, StoredCompanySnapshot>();

  public async saveQuote(quote: QuoteSnapshot): Promise<void> {
    this.quoteSaves += 1;
    this.snapshots.set(
      quote.symbol,
      Object.freeze({
        ticker: quote.symbol,
        companyName: quote.companyName ?? quote.symbol,
        exchange: quote.exchange,
        currency: quote.currency,
        secCik: null,
        updatedAt: quote.retrievedAt,
        latestQuote: Object.freeze({
          provider: quote.provider,
          price: quote.price,
          change: quote.change,
          percentChange: quote.percentChange,
          volume: quote.volume,
          marketSession: quote.marketSession,
          freshness: quote.freshness,
          providerTimestamp: quote.providerTimestamp,
          retrievedAt: quote.retrievedAt,
          feedDisclosure: quote.feedDisclosure,
        }),
        latestFiling: null,
        filingCount: 0,
        factCount: 0,
        ratingCount: 0,
      }),
    );
  }

  public async saveSecCompany(_company: SecCompany): Promise<void> {}
  public async saveSecFilings(
    _company: SecCompany,
    _filings: readonly SecFilingSummary[],
  ): Promise<void> {}
  public async saveSecFacts(_summary: SecCompanyFactsSummary): Promise<void> {}

  public async getStoredCompany(symbol: string): Promise<StoredCompanySnapshot | null> {
    return this.snapshots.get(symbol) ?? null;
  }

  public async close(): Promise<void> {}
}

test("health and provider status never expose configured secrets", async (t) => {
  const provider = new StaticMarketDataProvider();
  const app = await buildApp({ config: testConfig(), provider, logger: false });
  t.after(async () => app.close());

  const health = await app.inject({ method: "GET", url: "/api/health" });
  const status = await app.inject({ method: "GET", url: "/api/provider-status" });
  const combined = `${health.body}\n${status.body}`;

  assert.equal(health.statusCode, 200);
  assert.equal(status.statusCode, 200);
  assert.equal(combined.includes(TEST_SECRET), false);
  assert.equal(status.json().marketData.secretExposed, false);
  assert.equal(status.json().sec.userAgentExposed, false);
  assert.equal(status.json().database.connectionStringExposed, false);
  assert.equal(health.json().database.configured, false);
});

test("ticker search requires a query and caps the requested limit", async (t) => {
  const provider = new StaticMarketDataProvider();
  const app = await buildApp({ config: testConfig(), provider, logger: false });
  t.after(async () => app.close());

  const missing = await app.inject({ method: "GET", url: "/api/tickers" });
  const found = await app.inject({ method: "GET", url: "/api/tickers?q=aapl&limit=999" });

  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().error, "missing_query");
  assert.equal(found.statusCode, 200);
  assert.equal(found.json().query, "aapl");
  assert.equal(found.json().count, 1);
});

test("quote route normalizes valid symbols and rejects unsupported characters", async (t) => {
  const provider = new StaticMarketDataProvider();
  const app = await buildApp({ config: testConfig(), provider, logger: false });
  t.after(async () => app.close());

  const valid = await app.inject({ method: "GET", url: "/api/quotes/aapl" });
  const invalid = await app.inject({ method: "GET", url: "/api/quotes/AAPL%2F..%2Fsecret" });

  assert.equal(valid.statusCode, 200);
  assert.equal(valid.json().symbol, "AAPL");
  assert.equal(valid.json().price, 123.45);
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "invalid_symbol");
  assert.equal(provider.quoteCalls, 1);
});

test("quote retrieval persists a snapshot that can be read later", async (t) => {
  const provider = new StaticMarketDataProvider();
  const persistenceStore = new MemoryPersistenceStore();
  const app = await buildApp({
    config: testConfig(),
    provider,
    persistenceStore,
    logger: false,
  });
  t.after(async () => app.close());

  const quote = await app.inject({ method: "GET", url: "/api/quotes/aapl" });
  const stored = await app.inject({ method: "GET", url: "/api/stored/AAPL" });

  assert.equal(quote.statusCode, 200);
  assert.equal(stored.statusCode, 200);
  assert.equal(persistenceStore.quoteSaves, 1);
  assert.equal(stored.json().ticker, "AAPL");
  assert.equal(stored.json().latestQuote.price, 123.45);
  assert.equal(stored.json().database, "memory-test-database");
});

test("stored snapshot route reports a missing persisted company honestly", async (t) => {
  const app = await buildApp({
    config: testConfig(),
    persistenceStore: new MemoryPersistenceStore(),
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/stored/MISSING" });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error, "stored_company_not_found");
});

test("quote cache reuses a recent provider result", async (t) => {
  const provider = new StaticMarketDataProvider();
  const app = await buildApp({ config: testConfig(), provider, logger: false });
  t.after(async () => app.close());

  const first = await app.inject({ method: "GET", url: "/api/quotes/AAPL" });
  const second = await app.inject({ method: "GET", url: "/api/quotes/AAPL" });

  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.equal(provider.quoteCalls, 1);
  assert.deepEqual(second.json(), first.json());
});

test("batch quote route deduplicates symbols and contains partial failures", async (t) => {
  const provider = new StaticMarketDataProvider(new Set(["FAIL"]));
  const app = await buildApp({
    config: testConfig(),
    provider,
    quoteBatchConcurrency: 2,
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/quotes?symbols=aapl,NVDA,AAPL,FAIL",
  });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.requestedCount, 3);
  assert.equal(payload.successCount, 2);
  assert.equal(payload.failureCount, 1);
  assert.deepEqual(
    payload.results.map((result: { symbol: string }) => result.symbol),
    ["AAPL", "NVDA", "FAIL"],
  );
  assert.equal(payload.results[2].error, "quote_unavailable");
  assert.equal(response.body.includes("Test-only failure"), false);
  assert.equal(provider.quoteCalls, 3);
});

test("batch quote route validates missing, malformed, and oversized requests", async (t) => {
  const provider = new StaticMarketDataProvider();
  const app = await buildApp({ config: testConfig(), provider, logger: false });
  t.after(async () => app.close());

  const missing = await app.inject({ method: "GET", url: "/api/quotes" });
  const malformed = await app.inject({
    method: "GET",
    url: "/api/quotes?symbols=AAPL,BAD%2F..%2FSYMBOL",
  });
  const oversizedSymbols = Array.from({ length: 26 }, (_, index) => `S${index}`).join(",");
  const oversized = await app.inject({
    method: "GET",
    url: `/api/quotes?symbols=${oversizedSymbols}`,
  });

  assert.equal(missing.statusCode, 400);
  assert.equal(missing.json().error, "missing_symbols");
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().error, "invalid_symbols");
  assert.equal(oversized.statusCode, 400);
  assert.equal(oversized.json().error, "too_many_symbols");
  assert.equal(provider.quoteCalls, 0);
});

test("unconfigured provider returns a clear 503 instead of invented data", async (t) => {
  const app = await buildApp({
    config: {
      ...testConfig(),
      marketDataProvider: "unconfigured",
      twelveDataApiKey: null,
    },
    provider: new UnconfiguredMarketDataProvider(),
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/quotes/AAPL" });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "provider_not_configured");
  assert.match(response.json().message, /not configured/i);
  assert.equal(response.body.includes("123.45"), false);
});

test("readiness route returns 503 until the private database is configured", async (t) => {
  const app = await buildApp({ config: testConfig(), logger: false });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/readiness" });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "provider_not_configured");
  assert.match(response.json().message, /database readiness provider/i);
});
