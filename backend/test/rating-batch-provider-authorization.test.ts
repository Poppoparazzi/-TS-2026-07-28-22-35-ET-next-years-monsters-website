// TS: 2026-09-05 18:12 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { PersistenceStore, StoredCompanySnapshot } from "../src/database/persistence.js";
import type { PersistedMarketHistorySuppression } from "../src/database/market-history-evidence-persistence.js";
import { runRatingBatch } from "../src/jobs/rating-batch.js";
import type { DailyMarketHistory, MarketDataProvider, QuoteSnapshot, TickerSearchResult } from "../src/providers/types.js";
import type { MarketHistoryEvidence } from "../src/ratings/market-history-evidence.js";
import type { EligibleProductionRating } from "../src/ratings/types.js";
import type { RatingBatchAccounting, RatingBatchCandidate, RatingBatchStore } from "../src/ratings/batch-store.js";
import type { SecCompany, SecCompanyFactsSummary, SecDataProvider, SecFactSnapshot, SecFilingSummary } from "../src/sec/types.js";

function fact(year: number, key: string, value: number): SecFactSnapshot {
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
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/GOOD-${year}.htm`,
  });
}

function completeFacts(): SecCompanyFactsSummary {
  const years = [2023, 2024, 2025];
  const revenue = years.map((year, index) => fact(year, "revenue", 100 + index * 40));
  const metric = (key: string, ratio: number) => years.map((year, index) =>
    fact(year, key, (100 + index * 40) * ratio));
  return Object.freeze({
    ticker: "GOOD",
    cik: 1,
    companyName: "GOOD Company",
    retrievedAt: new Date().toISOString(),
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

function benchmarkHistory(): DailyMarketHistory {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  return Object.freeze({
    symbol: "SPY",
    provider: "test-market",
    retrievedAt: new Date().toISOString(),
    feedDisclosure: "Test history.",
    bars: Object.freeze(Array.from({ length: 300 }, (_, index) => {
      const date = new Date(end.getTime() - (299 - index) * 24 * 60 * 60 * 1_000);
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        open: 100,
        high: 101,
        low: 99,
        close: 100 + index * 0.1,
        volume: 2_000_000,
      });
    })),
  });
}

class AuthorizationFailingMarketProvider implements MarketDataProvider {
  public readonly name = "test-market";
  public readonly configured = true;
  public async searchTickers(_query: string, _limit = 10): Promise<readonly TickerSearchResult[]> { return []; }
  public async getQuote(_symbol: string): Promise<QuoteSnapshot> { throw new Error("Not used."); }
  public async getDailyHistory(symbol: string): Promise<DailyMarketHistory> {
    if (symbol === "SPY") return benchmarkHistory();
    throw new Error("HTTP 403: provider entitlement denied");
  }
}

class CompleteSecProvider implements SecDataProvider {
  public readonly name = "test-sec";
  public readonly configured = true;
  public async getCompany(symbol: string): Promise<SecCompany> {
    return Object.freeze({ ticker: symbol, cik: 1, cikPadded: "0000000001", companyName: `${symbol} Company`, exchange: "NASDAQ", sourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json" });
  }
  public async getRecentFilings(_symbol: string): Promise<readonly SecFilingSummary[]> { return []; }
  public async getCompanyFacts(_symbol: string): Promise<SecCompanyFactsSummary> { return completeFacts(); }
}

class MemoryPersistenceStore implements PersistenceStore {
  public readonly name = "test-db";
  public readonly configured = true;
  public readonly ratings: EligibleProductionRating[] = [];
  public async saveQuote(_quote: QuoteSnapshot): Promise<void> {}
  public async saveSecCompany(_company: SecCompany): Promise<void> {}
  public async saveSecFilings(_company: SecCompany, _filings: readonly SecFilingSummary[]): Promise<void> {}
  public async saveSecFacts(_summary: SecCompanyFactsSummary): Promise<void> {}
  public async saveRating(rating: EligibleProductionRating): Promise<void> { this.ratings.push(rating); }
  public async getStoredCompany(_symbol: string): Promise<StoredCompanySnapshot | null> { return null; }
  public async close(): Promise<void> {}
}

class OneCandidateBatchStore implements RatingBatchStore {
  public readonly name = "test-db";
  public readonly configured = true;
  public finished: RatingBatchAccounting | null = null;
  private readonly candidates: readonly RatingBatchCandidate[] = Object.freeze([
    Object.freeze({ ticker: "GOOD", companyName: "GOOD Company", isPilot: false, isProtected: false, priorityMetric: 10 }),
  ]);
  public async listCandidates(limit: number): Promise<readonly RatingBatchCandidate[]> { return this.candidates.slice(0, limit); }
  public async startRun(_targetCount: number, _provider: string): Promise<string> { return "1"; }
  public async getReusableMarketHistorySuppression(
    _ticker: string,
    _provider: string,
  ): Promise<PersistedMarketHistorySuppression | null> { return null; }
  public async tryClaimMarketHistoryRequest(_ticker: string, _provider: string, _runId: string): Promise<boolean> { return true; }
  public async releaseMarketHistoryRequestClaim(_ticker: string, _provider: string, _runId: string): Promise<boolean> { return true; }
  public async saveMarketHistoryEvidence(_evidence: MarketHistoryEvidence): Promise<void> {}
  public async finishRun(_runId: string, accounting: RatingBatchAccounting): Promise<void> { this.finished = accounting; }
  public async close(): Promise<void> {}
}

test("rating batch treats provider authorization failures as batch-level outages, not candidate defects", async () => {
  const batchStore = new OneCandidateBatchStore();
  const accounting = await runRatingBatch(
    {
      marketProvider: new AuthorizationFailingMarketProvider(),
      secProvider: new CompleteSecProvider(),
      persistenceStore: new MemoryPersistenceStore(),
      batchStore,
    },
    { targetCount: 1, candidateLimit: 1 },
  );

  assert.equal(accounting.ratedCount, 0);
  assert.equal(accounting.protectedMustRepairCount, 0);
  assert.equal(accounting.replaceableCount, 0);
  assert.match(accounting.stoppedReason ?? "", /market-data provider unavailable.*GOOD.*HTTP 403.*entitlement/i);
  assert.deepEqual(batchStore.finished, accounting);
});