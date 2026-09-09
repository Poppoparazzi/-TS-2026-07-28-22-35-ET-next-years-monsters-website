// TS: 2026-09-09 09:01 ET

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

function dependencies(
  claimResults: readonly boolean[],
  options: {
    readonly failFirstCandidateHistoryWithQuota?: boolean;
    readonly suppressAfterFirstCandidateHistory?: boolean;
    readonly invalidCachedBenchmark?: boolean;
  } = {},
) {
  const historyRequests: string[] = [];
  const cachedHistoryRequests: string[] = [];
  const claims: string[] = [];
  const releases: string[] = [];
  const failures: Array<{ ticker: string; reason?: string; reasonCode?: string; suppressionStage?: string }> = [];
  let candidateHistoryAttempts = 0;
  let claimIndex = 0;
  const marketProvider = {
    name: "claim-test-market",
    configured: true,
    async getCachedDailyHistory(symbol: string) {
      cachedHistoryRequests.push(symbol);
      if (!options.invalidCachedBenchmark) return null;
      const cached = history(symbol);
      return Object.freeze({ ...cached, bars: Object.freeze(cached.bars.slice(-100)) });
    },
    async getDailyHistory(symbol: string) {
      historyRequests.push(symbol);
      if (symbol === "GOOD") {
        candidateHistoryAttempts += 1;
        if (options.failFirstCandidateHistoryWithQuota && candidateHistoryAttempts === 1) {
          throw new Error("API credits quota reached");
        }
      }
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
    async getReusableMarketHistorySuppression() {
      if (options.suppressAfterFirstCandidateHistory && candidateHistoryAttempts >= 1) {
        return Object.freeze({
          ticker: "GOOD",
          provider: "claim-test-market",
          usableBarCount: 300,
          averageDollarVolume20d: 900_000,
          suppressionReason: "insufficient_liquidity" as const,
        });
      }
      return null;
    },
    async tryClaimMarketHistoryRequest(ticker: string) {
      claims.push(ticker);
      const result = claimResults[Math.min(claimIndex, claimResults.length - 1)] ?? false;
      claimIndex += 1;
      return result;
    },
    async releaseMarketHistoryRequestClaim(ticker: string) { releases.push(ticker); return true; },
    async saveMarketHistoryEvidence() {},
    async recordCandidateFailure(_runId: string, failure: { ticker: string; reason?: string; reasonCode?: string; suppressionStage?: string }) {
      failures.push(failure);
    },
    async finishRun() {},
    async close() {},
  };
  return { dependencies: { marketProvider, secProvider, persistenceStore, batchStore } as any, historyRequests, cachedHistoryRequests, claims, releases, failures };
}

test("a lost market-history claim spends zero candidate-history or benchmark calls", async () => {
  const fixture = dependencies([false]);
  await runRatingBatch(fixture.dependencies, { targetCount: 1, candidateLimit: 1 });

  assert.deepEqual(fixture.claims, ["GOOD"]);
  assert.deepEqual(fixture.cachedHistoryRequests, [], "a lost company claim must not even enter benchmark cache preflight");
  assert.deepEqual(fixture.historyRequests, [], "a lost candidate claim must not spend either candidate or SPY quota");
  assert.deepEqual(fixture.releases, []);
});

test("fresh invalid cached SPY spends zero company-history quota", async () => {
  const fixture = dependencies([true], { invalidCachedBenchmark: true });
  const accounting = await runRatingBatch(fixture.dependencies, { targetCount: 1, candidateLimit: 1 });

  assert.deepEqual(fixture.claims, ["GOOD"], "company ownership must be established before cache-only benchmark preflight");
  assert.deepEqual(fixture.cachedHistoryRequests, ["SPY"], "the persisted benchmark must be inspected exactly once");
  assert.deepEqual(fixture.historyRequests, [], "known-bad persisted SPY must spend exactly zero paid company-history or benchmark calls");
  assert.deepEqual(fixture.releases, ["GOOD"], "the company history claim must still be released when benchmark preflight stops the batch");
  assert.equal(accounting.ratedCount, 0);
  assert.match(accounting.stoppedReason ?? "", /Persisted benchmark preflight blocked paid company history/);
});

test("a won market-history claim is released after candidate processing", async () => {
  const fixture = dependencies([true]);
  await runRatingBatch(fixture.dependencies, { targetCount: 1, candidateLimit: 1 });

  assert.deepEqual(fixture.claims, ["GOOD"]);
  assert.deepEqual(fixture.cachedHistoryRequests, ["SPY"]);
  assert.deepEqual(fixture.historyRequests, ["GOOD", "SPY"], "company evidence must survive before shared benchmark quota is spent");
  assert.deepEqual(fixture.releases, ["GOOD"]);
});

test("failed claim renewal after quota backoff spends zero additional candidate-history or benchmark calls", async () => {
  const fixture = dependencies([true, false], { failFirstCandidateHistoryWithQuota: true });
  await runRatingBatch(fixture.dependencies, {
    targetCount: 1,
    candidateLimit: 1,
    marketLimitRetryMs: 0,
    marketLimitMaxRetries: 1,
  });

  assert.deepEqual(fixture.claims, ["GOOD", "GOOD"], "initial ownership and the retry renewal must both be attempted");
  assert.deepEqual(fixture.historyRequests, ["GOOD"], "failed renewal must prevent a second GOOD request and must not spend SPY quota");
  assert.deepEqual(fixture.releases, ["GOOD"], "the original owner must still release its bounded claim");
});

test("durable suppression appearing during quota backoff blocks retry and records its machine-readable reason", async () => {
  const fixture = dependencies([true, true], {
    failFirstCandidateHistoryWithQuota: true,
    suppressAfterFirstCandidateHistory: true,
  });
  await runRatingBatch(fixture.dependencies, {
    targetCount: 1,
    candidateLimit: 1,
    marketLimitRetryMs: 0,
    marketLimitMaxRetries: 1,
  });

  assert.deepEqual(fixture.claims, ["GOOD", "GOOD"], "the worker must renew ownership before reconsidering the paid retry");
  assert.deepEqual(fixture.historyRequests, ["GOOD"], "persisted suppression discovered after renewal must prevent a second GOOD request and all SPY quota");
  assert.deepEqual(fixture.releases, ["GOOD"], "the owner must release its claim after suppression aborts the retry");
  assert.equal(fixture.failures.length, 1, "the durable suppression must create exactly one candidate accounting record");
  assert.equal(fixture.failures[0]?.ticker, "GOOD");
  assert.equal(fixture.failures[0]?.reasonCode, "insufficient_liquidity");
  assert.equal(fixture.failures[0]?.suppressionStage, "stored_market_history_preflight");
  assert.match(fixture.failures[0]?.reason ?? "", /persisted provider-backed market history/i, "the accounting record should preserve the human-readable persisted-evidence explanation too");
});
