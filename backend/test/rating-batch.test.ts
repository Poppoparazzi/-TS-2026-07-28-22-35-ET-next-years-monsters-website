// TS: 2026-08-23 14:00 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { PersistenceStore, StoredCompanySnapshot } from "../src/database/persistence.js";
import { runRatingBatch } from "../src/jobs/rating-batch.js";
import type { DailyMarketHistory, MarketDataProvider, QuoteSnapshot, TickerSearchResult } from "../src/providers/types.js";
import type { EligibleProductionRating } from "../src/ratings/types.js";
import type { RatingBatchAccounting, RatingBatchCandidate, RatingBatchStore } from "../src/ratings/batch-store.js";
import type { SecCompany, SecCompanyFactsSummary, SecDataProvider, SecFactSnapshot, SecFilingSummary } from "../src/sec/types.js";

function history(symbol: string, dailyGrowth: number): DailyMarketHistory {
  const end = new Date("2026-08-21T00:00:00.000Z");
  return Object.freeze({
    symbol,
    provider: "test-market",
    retrievedAt: "2026-08-21T17:08:00.000Z",
    feedDisclosure: "Test end-of-day history.",
    bars: Object.freeze(Array.from({ length: 300 }, (_, index) => {
      const date = new Date(end.getTime() - (299 - index) * 24 * 60 * 60 * 1_000);
      const close = 20 * (1 + dailyGrowth) ** index;
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        open: close - 0.2,
        high: close + 0.5,
        low: close - 0.5,
        close,
        volume: 2_000_000 + index * 1_000,
      });
    })),
  });
}

function fact(symbol: string, year: number, key: string, value: number): SecFactSnapshot {
  return Object.freeze({
    key,
    taxonomy: "us-gaap",
    tag: key,
    label: key,
    description: key,
    unit: "USD",
    value,
    form: "10-K",
    fiscalYear: year,
    fiscalPeriod: "FY",
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    filed: `${year + 1}-02-15`,
    accessionNumber: `0000000001-${String(year).slice(-2)}-000001`,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${symbol}-${year}.htm`,
  });
}

function facts(symbol: string, complete: boolean): SecCompanyFactsSummary {
  const years = complete ? [2023, 2024, 2025] : [2025];
  const revenue = years.map((year, index) => fact(symbol, year, "revenue", 100 + index * 40));
  const metric = (key: string, ratio: number) => years.map((year, index) =>
    fact(symbol, year, key, (100 + index * 40) * ratio));
  return Object.freeze({
    ticker: symbol,
    cik: 1,
    companyName: `${symbol} Company`,
    retrievedAt: "2026-08-21T17:08:00.000Z",
    sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
    disclosure: "Test SEC evidence.",
    facts: Object.freeze({ revenue: revenue.at(-1)! }),
    history: Object.freeze({
      revenue: Object.freeze(revenue),
      grossProfit: Object.freeze(metric("grossProfit", 0.55)),
      operatingIncome: Object.freeze(metric("operatingIncome", 0.22)),
      netIncome: Object.freeze(metric("netIncome", 0.14)),
      assets: Object.freeze(metric("assets", 1.4)),
      liabilities: Object.freeze(metric("liabilities", 0.55)),
      cash: Object.freeze(metric("cash", 0.2)),
      operatingCashFlow: Object.freeze(metric("operatingCashFlow", 0.25)),
    }),
  });
}

class BatchMarketProvider implements MarketDataProvider {
  public readonly name = "test-market";
  public readonly configured = true;
  public async searchTickers(_query: string, _limit = 10): Promise<readonly TickerSearchResult[]> { return []; }
  public async getQuote(_symbol: string): Promise<QuoteSnapshot> { throw new Error("Not used."); }
  public async getDailyHistory(symbol: string): Promise<DailyMarketHistory> {
    return history(symbol, symbol === "SPY" ? 0.0005 : 0.002);
  }
}

class BenchmarkFailingMarketProvider extends BatchMarketProvider {
  public override async getDailyHistory(symbol: string): Promise<DailyMarketHistory> {
    if (symbol === "SPY") throw new Error("Test benchmark quota reached.");
    return super.getDailyHistory(symbol);
  }
}

class BatchSecProvider implements SecDataProvider {
  public readonly name = "test-sec";
  public readonly configured = true;
  public async getCompany(symbol: string): Promise<SecCompany> {
    return Object.freeze({
      ticker: symbol,
      cik: 1,
      cikPadded: "0000000001",
      companyName: `${symbol} Company`,
      exchange: "NASDAQ",
      sourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json",
    });
  }
  public async getRecentFilings(_symbol: string): Promise<readonly SecFilingSummary[]> { return []; }
  public async getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary> {
    return facts(symbol, symbol === "GOOD");
  }
}

class BatchPersistenceStore implements PersistenceStore {
  public readonly name = "test-db";
  public readonly configured = true;
  public readonly ratings: EligibleProductionRating[] = [];
  public readonly savedQuotes: string[] = [];
  public readonly savedCompanies: string[] = [];
  public readonly savedFilings: string[] = [];
  public readonly savedFacts: string[] = [];
  public async saveQuote(quote: QuoteSnapshot): Promise<void> { this.savedQuotes.push(quote.symbol); }
  public async saveSecCompany(company: SecCompany): Promise<void> { this.savedCompanies.push(company.ticker); }
  public async saveSecFilings(company: SecCompany, _filings: readonly SecFilingSummary[]): Promise<void> { this.savedFilings.push(company.ticker); }
  public async saveSecFacts(summary: SecCompanyFactsSummary): Promise<void> { this.savedFacts.push(summary.ticker); }
  public async saveRating(rating: EligibleProductionRating): Promise<void> { this.ratings.push(rating); }
  public async getStoredCompany(_symbol: string): Promise<StoredCompanySnapshot | null> { return null; }
  public async close(): Promise<void> {}
}

class MemoryBatchStore implements RatingBatchStore {
  public readonly name = "test-db";
  public readonly configured = true;
  public finished: RatingBatchAccounting | null = null;
  public readonly candidates: readonly RatingBatchCandidate[] = Object.freeze([
    Object.freeze({ ticker: "AAPL", companyName: "Apple", isPilot: true, isProtected: true, priorityMetric: 10 }),
    Object.freeze({ ticker: "FAIL", companyName: "Replaceable", isPilot: false, isProtected: false, priorityMetric: 9 }),
    Object.freeze({ ticker: "GOOD", companyName: "Rated", isPilot: false, isProtected: false, priorityMetric: 8 }),
  ]);
  public async listCandidates(limit: number): Promise<readonly RatingBatchCandidate[]> { return this.candidates.slice(0, limit); }
  public async startRun(_targetCount: number, _provider: string): Promise<string> { return "1"; }
  public async finishRun(_runId: string, accounting: RatingBatchAccounting): Promise<void> { this.finished = accounting; }
  public async close(): Promise<void> {}
}

test("rating batch retains protected failures, replaces ordinary failures, and reaches its target", async () => {
  const persistenceStore = new BatchPersistenceStore();
  const batchStore = new MemoryBatchStore();
  const accounting = await runRatingBatch(
    {
      marketProvider: new BatchMarketProvider(),
      secProvider: new BatchSecProvider(),
      persistenceStore,
      batchStore,
    },
    { targetCount: 1, candidateLimit: 3 },
  );

  assert.equal(accounting.totalCandidatesExamined, 3);
  assert.equal(accounting.ratedCount, 1);
  assert.deepEqual(accounting.ratedTickers, ["GOOD"]);
  assert.equal(accounting.protectedMustRepairCount, 1);
  assert.equal(accounting.protectedMustRepair[0]?.ticker, "AAPL");
  assert.equal(accounting.replaceableCount, 1);
  assert.equal(accounting.replaceable[0]?.ticker, "FAIL");
  assert.equal(accounting.replacementsAttempted, 1);
  assert.equal(accounting.finalUsableUniverse, 1);
  assert.equal(accounting.stoppedReason, null);
  assert.equal(persistenceStore.ratings.length, 1);
  assert.deepEqual(persistenceStore.savedCompanies, ["AAPL", "FAIL", "GOOD"]);
  assert.deepEqual(persistenceStore.savedFilings, ["AAPL", "FAIL", "GOOD"]);
  assert.deepEqual(persistenceStore.savedFacts, ["AAPL", "FAIL", "GOOD"]);
  assert.deepEqual(persistenceStore.savedQuotes, ["GOOD"]);
  assert.deepEqual(batchStore.finished, accounting);
});

test("rating batch closes its audit run when benchmark history is unavailable", async () => {
  const persistenceStore = new BatchPersistenceStore();
  const batchStore = new MemoryBatchStore();
  const accounting = await runRatingBatch(
    {
      marketProvider: new BenchmarkFailingMarketProvider(),
      secProvider: new BatchSecProvider(),
      persistenceStore,
      batchStore,
    },
    { targetCount: 1, candidateLimit: 3 },
  );

  assert.equal(accounting.totalCandidatesExamined, 3);
  assert.equal(accounting.ratedCount, 0);
  assert.match(accounting.stoppedReason ?? "", /benchmark quota/i);
  assert.deepEqual(persistenceStore.savedCompanies, ["AAPL", "FAIL", "GOOD"]);
  assert.deepEqual(persistenceStore.savedFacts, ["AAPL", "FAIL", "GOOD"]);
  assert.deepEqual(persistenceStore.savedQuotes, []);
  assert.deepEqual(batchStore.finished, accounting);
});
