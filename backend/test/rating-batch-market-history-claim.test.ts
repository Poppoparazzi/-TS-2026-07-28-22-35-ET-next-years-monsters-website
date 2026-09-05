// TS: 2026-09-05 18:57 ET

import assert from "node:assert/strict";
import test from "node:test";
import { runRatingBatch } from "../src/jobs/rating-batch.js";

function history(symbol: string) {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  return Object.freeze({
    symbol,
    provider: "claim-test-market",
    retrievedAt: new Date().toISOString(),
    feedDisclosure: "Claim behavior test history.",
    bars: Object.freeze(Array.from({ length: 300 }, (_, index) => {
      const date = new Date(end.getTime() - (299 - index) * 86_400_000);
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        open: 20 + index * 0.01,
        high: 21 + index * 0.01,
        low: 19 + index * 0.01,
        close: 20.5 + index * 0.01,
        volume: 2_000_000,
      });
    })),
  });
}

function facts(symbol: string) {
  const revenue = [2023, 2024, 2025].map((year, index) => Object.freeze({
    key: "revenue",
    taxonomy: "us-gaap",
    tag: "RevenueFromContractWithCustomerExcludingAssessedTax",
    label: "Revenue",
    description: "Revenue",
    unit: "USD",
    value: 100_000_000 + index * 20_000_000,
    form: "10-K",
    fiscalYear: year,
    fiscalPeriod: "FY",
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    filed: `${year + 1}-02-15`,
    accessionNumber: `0000000001-${String(year).slice(-2)}-000001`,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${symbol}-${year}.htm`,
  }));
  return Object.freeze({
    ticker: symbol,
    cik: 1,
    companyName: `${symbol} Company`,
    retrievedAt: new Date().toISOString(),
    sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json",
    disclosure: "Claim behavior test SEC evidence.",
    facts: Object.freeze({ revenue: revenue.at(-1) }),
    history: Object.freeze({ revenue: Object.freeze(revenue) }),
  });
}

function dependencies(claimResult: boolean) {
  const historyRequests: string[] = [];
  const claims: string[] = [];
  const releases: string[] = [];
  const marketProvider = {
    name: "claim-test-market",
    configured: true,
    async getDailyHistory(symbol: string) {
      historyRequests.push(symbol);
      return history(symbol);
    },
  };
  const secProvider = {
    name: "claim-test-sec",
    configured: true,
    async getCompany(symbol: string) {
      return Object.freeze({ ticker: symbol, cik: 1, cikPadded: "0000000001", companyName: `${symbol} Company`, exchange: "NASDAQ", sourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json" });
    },
    async getCompanyFacts(symbol: string) { return facts(symbol); },
    async getRecentFilings() { return Object.freeze([]); },
  };
  const persistenceStore = {
    name: "claim-test-db",
    configured: true,
    async saveSecCompany() {},
    async saveSecFilings() {},
    async saveSecFacts() {},
    async saveQuote() {},
    async saveRating() {},
    async getStoredCompany() { return null; },
    async close() {},
  };
  const batchStore = {
    name: "claim-test-db",
    configured: true,
    async listCandidates() { return Object.freeze([Object.freeze({ ticker: "GOOD", companyName: "Good Company", isPilot: false, isProtected: false, priorityMetric: 1 })]); },
    async startRun() { return "claim-run"; },
    async getReusableMarketHistorySuppression() { return null; },
    async tryClaimMarketHistoryRequest(ticker: string) { claims.push(ticker); return claimResult; },
    async releaseMarketHistoryRequestClaim(ticker: string) { releases.push(ticker); return true; },
    async saveMarketHistoryEvidence() {},
    async finishRun() {},
    async close() {},
  };
  return { dependencies: { marketProvider, secProvider, persistenceStore, batchStore } as any, historyRequests, claims, releases };
}

test("a lost market-history claim spends zero candidate-history calls", async () => {
  const fixture = dependencies(false);
  await runRatingBatch(fixture.dependencies, { targetCount: 1, candidateLimit: 1 });

  assert.deepEqual(fixture.claims, ["GOOD"]);
  assert.deepEqual(fixture.historyRequests, ["SPY"]);
  assert.deepEqual(fixture.releases, []);
});

test("a won market-history claim is released after candidate processing", async () => {
  const fixture = dependencies(true);
  await runRatingBatch(fixture.dependencies, { targetCount: 1, candidateLimit: 1 });

  assert.deepEqual(fixture.claims, ["GOOD"]);
  assert.deepEqual(fixture.historyRequests, ["SPY", "GOOD"]);
  assert.deepEqual(fixture.releases, ["GOOD"]);
});
