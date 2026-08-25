// TS: 2026-08-25 19:01 ET

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
  DailyMarketHistory,
  MarketDataProvider,
  QuoteSnapshot,
  TickerSearchResult,
} from "../src/providers/types.js";
import type { EligibleProductionRating } from "../src/ratings/types.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecDataProvider,
  SecFactSnapshot,
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
  public readonly name: string = "static-test-provider";
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

function dailyHistory(symbol: string, dailyGrowth: number): DailyMarketHistory {
  // Keep this fixture fresh relative to the test clock so the route test does not
  // rot as calendar time advances. The rating engine intentionally rejects stale
  // market history in production, and the fixture should exercise eligibility,
  // not accidentally become a stale-data test weeks later.
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  return Object.freeze({
    symbol,
    provider: "historical-test-provider",
    retrievedAt: new Date(end.getTime() + 15 * 60 * 60 * 1_000).toISOString(),
    feedDisclosure: "Test end-of-day history.",
    bars: Object.freeze(Array.from({ length: 300 }, (_, index) => {
      const date = new Date(end.getTime() - (299 - index) * 24 * 60 * 60 * 1_000);
      const close = 25 * (1 + dailyGrowth) ** index;
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        open: close - 0.25,
        high: close + 0.5,
        low: close - 0.5,
        close,
        volume: 2_500_000 + index * 1_000,
      });
    })),
  });
}

class HistoricalStaticMarketDataProvider extends StaticMarketDataProvider {
  public override readonly name = "historical-test-provider";
  public historyCalls = 0;

  public async getDailyHistory(symbol: string): Promise<DailyMarketHistory> {
    this.historyCalls += 1;
    return dailyHistory(symbol, symbol === "SPY" ? 0.0004 : 0.0018);
  }
}

class MemoryPersistenceStore implements PersistenceStore {
  public readonly name = "memory-test-database";
  public readonly configured = true;
  public quoteSaves = 0;
  public ratingSaves = 0;
  private readonly snapshots = new Map<string, StoredCompanySnapshot>();
  private readonly ratings = new Map<string, EligibleProductionRating>();

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
  public async saveRating(rating: EligibleProductionRating): Promise<void> {
    this.ratingSaves += 1;
    this.ratings.set(rating.symbol, rating);
  }

  public async getLatestRating(symbol: string): Promise<EligibleProductionRating | null> {
    return this.ratings.get(symbol) ?? null;
  }

  public async getStoredCompany(symbol: string): Promise<StoredCompanySnapshot | null> {
    return this.snapshots.get(symbol) ?? null;
  }

  public async close(): Promise<void> {}
}

class StaticSecDataProvider implements SecDataProvider {
  public readonly name = "static-test-sec";
  public readonly configured = true;

  public async getCompany(symbol: string): Promise<SecCompany> {
    return Object.freeze({
      ticker: symbol,
      cik: 320193,
      cikPadded: "0000320193",
      companyName: "Apple Inc.",
      exchange: "Nasdaq",
      sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=320193",
    });
  }

  public async getRecentFilings(symbol: string): Promise<readonly SecFilingSummary[]> {
    return Object.freeze([
      Object.freeze({
        ticker: symbol,
        cik: 320193,
        companyName: "Apple Inc.",
        accessionNumber: "0000320193-26-000001",
        filingDate: "2026-08-20",
        reportDate: "2026-06-30",
        acceptanceDateTime: "2026-08-20T20:00:00.000Z",
        form: "10-Q",
        fileNumber: "001-36743",
        primaryDocument: "aapl-20260630.htm",
        primaryDocumentUrl: "https://www.sec.gov/Archives/edgar/data/320193/aapl-20260630.htm",
      }),
    ]);
  }

  public async getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary> {
    return Object.freeze({
      ticker: symbol,
      cik: 320193,
      companyName: "Apple Inc.",
      retrievedAt: "2026-08-21T15:00:00.000Z",
      sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
      disclosure: "Test SEC facts.",
      facts: Object.freeze({
        revenue: Object.freeze({
          key: "revenue",
          taxonomy: "us-gaap",
          tag: "RevenueFromContractWithCustomerExcludingAssessedTax",
          label: "Revenue",
          description: "Quarterly revenue.",
          unit: "USD",
          value: 100,
          form: "10-Q",
          fiscalYear: 2026,
          fiscalPeriod: "Q3",
          periodStart: "2026-04-01",
          periodEnd: "2026-06-30",
          filed: "2026-08-20",
          accessionNumber: "0000320193-26-000001",
          sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
        }),
      }),
    });
  }
}

function annualFact(year: number, key: string, value: number): SecFactSnapshot {
  return Object.freeze({
    key,
    taxonomy: "us-gaap",
    tag: key,
    label: key,
    description: `Test ${key}.`,
    unit: "USD",
    value,
    form: "10-K",
    fiscalYear: year,
    fiscalPeriod: "FY",
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    filed: `${year + 1}-02-15`,
    accessionNumber: `0000320193-${String(year).slice(-2)}-000001`,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/320193/aapl-${year}.htm`,
  });
}

class HistoricalStaticSecDataProvider extends StaticSecDataProvider {
  public override async getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary> {
    const years = [2023, 2024, 2025];
    const revenues = years.map((year, index) => annualFact(year, "revenue", 100 + index * 30));
    const metric = (key: string, ratio: number) => years.map((year, index) =>
      annualFact(year, key, (100 + index * 30) * ratio));
    return Object.freeze({
      ticker: symbol,
      cik: 320193,
      companyName: "Apple Inc.",
      retrievedAt: "2026-08-21T15:00:00.000Z",
      sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
      disclosure: "Test SEC facts.",
      facts: Object.freeze({ revenue: revenues.at(-1)! }),
      history: Object.freeze({
        revenue: Object.freeze(revenues),
        grossProfit: Object.freeze(metric("grossProfit", 0.5)),
        operatingIncome: Object.freeze(metric("operatingIncome", 0.2)),
        netIncome: Object.freeze(metric("netIncome", 0.14)),
        assets: Object.freeze(metric("assets", 1.5)),
        liabilities: Object.freeze(metric("liabilities", 0.7)),
        cash: Object.freeze(metric("cash", 0.2)),
        operatingCashFlow: Object.freeze(metric("operatingCashFlow", 0.25)),
      }),
    });
  }
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

test("production rating route resolves a ticker with a stable fail-closed contract", async (t) => {
  const app = await buildApp({
    config: testConfig(),
    provider: new StaticMarketDataProvider(),
    secProvider: new StaticSecDataProvider(),
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/aapl" });
  const rating = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(rating.symbol, "AAPL");
  assert.equal(rating.engineVersion, "nym-current-stock-rating-v0.1-readiness-only");
  assert.equal(rating.eligible, false);
  assert.equal(rating.score, null);
  assert.equal(rating.tier, "NOT YET RATED");
  assert.equal(Array.isArray(rating.evidenceInputs), true);
  assert.equal(Array.isArray(rating.components), true);
  assert.equal(Array.isArray(rating.reasons), true);
  assert.ok(rating.reasons.length > 0);
});

test("production rating route stays usable when market data is unconfigured", async (t) => {
  const app = await buildApp({
    config: {
      ...testConfig(),
      marketDataProvider: "unconfigured",
      twelveDataApiKey: null,
    },
    provider: new UnconfiguredMarketDataProvider(),
    secProvider: new StaticSecDataProvider(),
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/aapl" });
  const rating = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(rating.symbol, "AAPL");
  assert.equal(rating.score, null);
  assert.equal(rating.tier, "NOT YET RATED");
  assert.equal(rating.eligibilityCode, "required_evidence_incomplete");
  assert.equal(rating.reasons[0]?.code, "gate_marketQuote");
});

test("production rating route calculates, saves, and reuses a visible numeric rating", async (t) => {
  const provider = new HistoricalStaticMarketDataProvider();
  const persistenceStore = new MemoryPersistenceStore();
  const app = await buildApp({
    config: testConfig(),
    provider,
    secProvider: new HistoricalStaticSecDataProvider(),
    persistenceStore,
    logger: false,
  });
  t.after(async () => app.close());

  const first = await app.inject({ method: "GET", url: "/api/ratings/AAPL" });
  const firstRating = first.json();
  const callsAfterCalculation = provider.historyCalls;
  const second = await app.inject({ method: "GET", url: "/api/ratings/AAPL" });
  const secondRating = second.json();

  assert.equal(first.statusCode, 200);
  assert.equal(firstRating.eligible, true);
  assert.equal(firstRating.engineVersion, "nym-current-stock-rating-v1.0.0");
  assert.ok(Number.isFinite(firstRating.score));
  assert.ok(firstRating.score >= 0 && firstRating.score <= 100);
  assert.ok(firstRating.evidenceInputs.some((item: { key: string; provider?: string }) =>
    item.key === "market_price" && item.provider === "historical-test-provider"));
  assert.ok(firstRating.evidenceInputs.some((item: { key: string }) => item.key === "latest_sec_filing"));
  assert.equal(persistenceStore.ratingSaves, 1);
  assert.equal(callsAfterCalculation, 2);
  assert.equal(second.statusCode, 200);
  assert.equal(secondRating.score, firstRating.score);
  assert.equal(provider.historyCalls, callsAfterCalculation);
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
