// TS: 2026-08-05 09:45 ET

import assert from "node:assert/strict";
import test from "node:test";
import type {
  DailyMarketHistory,
  MarketDataProvider,
  QuoteSnapshot,
  TickerSearchResult,
} from "../src/providers/types.js";
import { UnconfiguredMarketDataProvider } from "../src/providers/unconfigured.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecDataProvider,
  SecFactSnapshot,
  SecFilingSummary,
} from "../src/sec/types.js";
import type {
  CoverageCompany,
  ProviderHealthInput,
  RatingEvidenceStore,
} from "../src/ratings/evidence-store.js";
import { ProductionRatingService } from "../src/ratings/service.js";
import type {
  RatingHistoryEntry,
  RatingStore,
  RatingStoreStatus,
  SavedRatingResult,
} from "../src/ratings/store.js";
import type { ProductionRatingResult } from "../src/ratings/types.js";

function fact(
  key: string,
  value: number,
  year: number,
  options: { readonly instant?: boolean; readonly unit?: string } = {},
): SecFactSnapshot {
  return Object.freeze({
    key,
    taxonomy: "us-gaap",
    tag: key,
    label: key,
    description: "rating service test fact",
    unit: options.unit ?? (key === "dilutedEps" ? "USD/shares" : "USD"),
    value,
    form: "10-K",
    fiscalYear: year,
    fiscalPeriod: "FY",
    periodStart: options.instant ? null : `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    filed: `${year + 1}-02-15`,
    accessionNumber: `0000000001-${String(year + 1).slice(-2)}-000001`,
    sourceUrl: `https://www.sec.gov/example/${year}`,
  });
}

function secFacts(symbol = "TEST"): SecCompanyFactsSummary {
  const history: Record<string, readonly SecFactSnapshot[]> = {
    revenue: Object.freeze([fact("revenue", 1_500, 2025), fact("revenue", 1_100, 2024)]),
    grossProfit: Object.freeze([
      fact("grossProfit", 900, 2025),
      fact("grossProfit", 620, 2024),
    ]),
    operatingIncome: Object.freeze([
      fact("operatingIncome", 320, 2025),
      fact("operatingIncome", 210, 2024),
    ]),
    netIncome: Object.freeze([fact("netIncome", 230, 2025), fact("netIncome", 140, 2024)]),
    dilutedEps: Object.freeze([
      fact("dilutedEps", 4.6, 2025),
      fact("dilutedEps", 2.8, 2024),
    ]),
    assets: Object.freeze([
      fact("assets", 2_000, 2025, { instant: true }),
      fact("assets", 1_700, 2024, { instant: true }),
    ]),
    liabilities: Object.freeze([
      fact("liabilities", 700, 2025, { instant: true }),
      fact("liabilities", 750, 2024, { instant: true }),
    ]),
    shareholdersEquity: Object.freeze([
      fact("shareholdersEquity", 1_300, 2025, { instant: true }),
      fact("shareholdersEquity", 950, 2024, { instant: true }),
    ]),
    cash: Object.freeze([
      fact("cash", 350, 2025, { instant: true }),
      fact("cash", 240, 2024, { instant: true }),
    ]),
    operatingCashFlow: Object.freeze([
      fact("operatingCashFlow", 300, 2025),
      fact("operatingCashFlow", 190, 2024),
    ]),
  };
  return Object.freeze({
    ticker: symbol,
    cik: 1,
    companyName: "Test Corporation",
    retrievedAt: "2026-08-05T13:00:00.000Z",
    facts: Object.freeze(
      Object.fromEntries(
        Object.entries(history).flatMap(([key, values]) =>
          values[0] ? [[key, values[0]]] : [],
        ),
      ),
    ),
    factHistory: Object.freeze(history),
    sourceUrl: "https://data.sec.gov/example",
    disclosure: "Official SEC Evidence",
  });
}

function history(symbol: string, startPrice: number, change: number): DailyMarketHistory {
  const end = new Date("2026-08-04T00:00:00.000Z");
  const bars = Array.from({ length: 260 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (259 - index));
    const close = startPrice + change * index;
    return Object.freeze({
      date: date.toISOString().slice(0, 10),
      open: close - 0.1,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume: 2_000_000 + index * 1_000,
    });
  });
  return Object.freeze({
    symbol,
    companyName: symbol === "SPY" ? "SPDR S&P 500 ETF Trust" : "Test Corporation",
    exchange: "NASDAQ",
    securityType: symbol === "SPY" ? "ETF" : "Common Stock",
    currency: "USD",
    interval: "1day",
    bars: Object.freeze(bars),
    provider: "licensed-test",
    retrievedAt: "2026-08-05T13:00:00.000Z",
    feedDisclosure: "External Market Data · May Be Delayed",
  });
}

class StaticSecProvider implements SecDataProvider {
  public readonly name = "sec-test";
  public readonly configured = true;
  public calls = 0;

  public async getCompany(symbol: string): Promise<SecCompany> {
    return {
      ticker: symbol,
      cik: 1,
      cikPadded: "0000000001",
      companyName: "Test Corporation",
      exchange: "NASDAQ",
      sourceUrl: "https://www.sec.gov/example",
    };
  }

  public async getRecentFilings(
    _symbol: string,
    _limit = 10,
  ): Promise<readonly SecFilingSummary[]> {
    return Object.freeze([]);
  }

  public async getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary> {
    this.calls += 1;
    return secFacts(symbol);
  }
}

class StaticMarketProvider implements MarketDataProvider {
  public readonly name = "licensed-test";
  public readonly configured = true;
  public historyCalls: string[] = [];
  public failure: Error | null = null;

  public async searchTickers(
    _query: string,
    _limit = 10,
  ): Promise<readonly TickerSearchResult[]> {
    return Object.freeze([]);
  }

  public async getQuote(_symbol: string): Promise<QuoteSnapshot> {
    throw new Error("Quote is not used by the production rating service.");
  }

  public async getDailyHistory(symbol: string): Promise<DailyMarketHistory> {
    this.historyCalls.push(symbol);
    if (this.failure) throw this.failure;
    return symbol === "SPY" ? history("SPY", 400, 0.1) : history(symbol, 30, 0.2);
  }
}

class MemoryEvidenceStore implements RatingEvidenceStore {
  public readonly name = "memory-evidence";
  public readonly configured = true;
  public savedFacts = 0;
  public savedBars = 0;
  public health: ProviderHealthInput[] = [];

  public async getCoverageCompany(_symbol: string): Promise<CoverageCompany | null> {
    return null;
  }

  public async listCoverageCompanies(_limit = 2_000): Promise<readonly CoverageCompany[]> {
    return Object.freeze([]);
  }

  public async saveSecFactHistory(summary: SecCompanyFactsSummary): Promise<number> {
    const count = Object.values(summary.factHistory).reduce(
      (total, values) => total + values.length,
      0,
    );
    this.savedFacts += count;
    return count;
  }

  public async saveMarketHistory(value: DailyMarketHistory): Promise<number> {
    this.savedBars += value.bars.length;
    return value.bars.length;
  }

  public async recordProviderHealth(input: ProviderHealthInput): Promise<void> {
    this.health.push(input);
  }

  public async close(): Promise<void> {}
}

class MemoryRatingStore implements RatingStore {
  public readonly name = "memory-ratings";
  public readonly configured = true;
  public results: ProductionRatingResult[] = [];

  public async saveResult(result: ProductionRatingResult): Promise<SavedRatingResult> {
    this.results.push(result);
    return result.eligible
      ? { ratingRunId: "1", eligibilityResultId: null }
      : { ratingRunId: null, eligibilityResultId: "1" };
  }

  public async getCurrent(_symbol: string): Promise<ProductionRatingResult | null> {
    return null;
  }

  public async getHistory(
    _symbol: string,
    _limit = 20,
  ): Promise<readonly RatingHistoryEntry[]> {
    return Object.freeze([]);
  }

  public async getStatus(): Promise<RatingStoreStatus> {
    throw new Error("Status is not used in service tests.");
  }

  public async close(): Promise<void> {}
}

function company(overrides: Partial<CoverageCompany> = {}): CoverageCompany {
  return Object.freeze({
    id: "1",
    symbol: "TEST",
    companyName: "Test Corporation",
    exchange: "NASDAQ",
    securityType: "Common Stock",
    secCik: "0000000001",
    secIdentityResolved: true,
    ...overrides,
  });
}

function service(options: {
  readonly sec?: StaticSecProvider;
  readonly market?: MarketDataProvider;
  readonly evidence?: MemoryEvidenceStore;
  readonly ratings?: MemoryRatingStore;
} = {}) {
  const sec = options.sec ?? new StaticSecProvider();
  const market = options.market ?? new StaticMarketProvider();
  const evidence = options.evidence ?? new MemoryEvidenceStore();
  const ratings = options.ratings ?? new MemoryRatingStore();
  return {
    sec,
    market,
    evidence,
    ratings,
    instance: new ProductionRatingService({
      secProvider: sec,
      marketProvider: market,
      evidenceStore: evidence,
      ratingStore: ratings,
      benchmarkSymbol: "SPY",
      clock: () => new Date("2026-08-05T13:00:00.000Z"),
    }),
  };
}

test("rating service calculates, stores, and records verified eligible evidence", async () => {
  const setup = service();
  const outcome = await setup.instance.calculateAndStore(company());

  assert.equal(outcome.result.eligible, true);
  if (!outcome.result.eligible) assert.fail("Expected eligible production rating.");
  assert.ok(outcome.result.score >= 1 && outcome.result.score <= 100);
  assert.equal(outcome.saved.ratingRunId, "1");
  assert.ok(outcome.savedSecFactCount >= 20);
  assert.equal(outcome.savedMarketBarCount, 260);
  assert.deepEqual((setup.market as StaticMarketProvider).historyCalls, ["TEST", "SPY"]);
  assert.equal(setup.ratings.results.length, 1);
  assert.equal(setup.evidence.health.some((item) => item.providerType === "sec"), true);
  assert.equal(setup.evidence.health.some((item) => item.providerType === "market-data"), true);
  assert.equal(setup.evidence.health.some((item) => item.providerType === "rating-engine"), true);
});

test("missing market credentials preserve SEC progress and store Provider Not Connected", async () => {
  const setup = service({ market: new UnconfiguredMarketDataProvider() });
  const outcome = await setup.instance.calculateAndStore(company());

  assert.equal(outcome.result.eligible, false);
  assert.equal(outcome.result.summary, "Provider Not Connected");
  assert.ok(outcome.savedSecFactCount >= 20);
  assert.equal(outcome.savedMarketBarCount, 0);
  assert.equal(outcome.saved.eligibilityResultId, "1");
  assert.equal(
    setup.evidence.health.some(
      (item) => item.providerType === "market-data" && item.status === "unconfigured",
    ),
    true,
  );
});

test("unresolved SEC identity avoids provider calls and stores no invented score", async () => {
  const setup = service();
  const outcome = await setup.instance.calculateAndStore(
    company({ secCik: null, secIdentityResolved: false }),
  );

  assert.equal(outcome.result.eligible, false);
  assert.equal(outcome.result.summary, "Unresolved SEC Identity");
  assert.equal(setup.sec.calls, 0);
  assert.deepEqual((setup.market as StaticMarketProvider).historyCalls, []);
  assert.equal(outcome.savedSecFactCount, 0);
  assert.equal(outcome.savedMarketBarCount, 0);
});

test("transient market failure is retriable and does not store a misleading eligibility result", async () => {
  const market = new StaticMarketProvider();
  market.failure = new Error("licensed provider timeout");
  const setup = service({ market });

  await assert.rejects(
    setup.instance.calculateAndStore(company()),
    /licensed provider timeout/i,
  );
  assert.equal(setup.ratings.results.length, 0);
  assert.equal(
    setup.evidence.health.some(
      (item) => item.providerType === "market-data" && item.status === "failed",
    ),
    true,
  );
});

test("benchmark history is reused inside one bounded batch service instance", async () => {
  const setup = service();
  await setup.instance.calculateAndStore(company({ symbol: "AAA", id: "1" }));
  await setup.instance.calculateAndStore(company({ symbol: "BBB", id: "2" }));

  const calls = (setup.market as StaticMarketProvider).historyCalls;
  assert.equal(calls.filter((symbol) => symbol === "SPY").length, 1);
  assert.equal(calls.filter((symbol) => symbol !== "SPY").length, 2);
});
