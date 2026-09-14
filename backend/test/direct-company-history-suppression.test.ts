// TS: 2026-09-14 01:01 UTC

import assert from "node:assert/strict";
import test from "node:test";
import type { DailyMarketHistory, MarketDataProvider } from "../src/providers/types.js";
import type { RatingBatchStore } from "../src/ratings/batch-store.js";
import { loadDirectCompanyHistoryWithLease } from "../src/ratings/direct-company-history.js";
import type { MarketHistoryEvidence } from "../src/ratings/market-history-evidence.js";

function buildHistory(input: {
  symbol?: string;
  latestDate?: string;
  volume?: number;
  bars?: number;
} = {}): DailyMarketHistory {
  const barCount = input.bars ?? 260;
  const latestDate = new Date(`${input.latestDate ?? "2026-09-12"}T00:00:00.000Z`);
  const bars = Array.from({ length: barCount }, (_, index) => {
    const date = new Date(latestDate.getTime() - (barCount - 1 - index) * 24 * 60 * 60 * 1_000);
    return {
      date: date.toISOString().slice(0, 10),
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: input.volume ?? 2_000_000,
    };
  });

  return {
    symbol: input.symbol ?? "TEST",
    provider: "twelve-data",
    bars,
    retrievedAt: "2026-09-13T23:59:00.000Z",
    feedDisclosure: "test fixture",
  };
}

function provider(input: {
  cached: DailyMarketHistory | null;
  refreshed?: DailyMarketHistory;
  onPaidCall?: () => void;
}): MarketDataProvider {
  return {
    name: "twelve-data",
    configured: true,
    async searchTickers() { return []; },
    async getQuote() { throw new Error("not used"); },
    async getCachedDailyHistory() { return input.cached; },
    async getDailyHistory() {
      input.onPaidCall?.();
      return input.refreshed ?? buildHistory({ symbol: input.cached?.symbol ?? "TEST" });
    },
  };
}

test("fresh cached liquidity suppression skips both lease claim and paid refresh", async () => {
  let claimCalls = 0;
  let paidCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];
  const store = {
    configured: true,
    async tryClaimMarketHistoryRequest() {
      claimCalls += 1;
      return true;
    },
    async getReusableMarketHistorySuppression() { return null; },
    async releaseMarketHistoryRequestClaim() { return true; },
    async saveMarketHistoryEvidence(evidence: MarketHistoryEvidence) {
      savedReasons.push(evidence.suppressionReason);
    },
  } as unknown as RatingBatchStore;

  const result = await loadDirectCompanyHistoryWithLease({
    marketProvider: provider({
      cached: buildHistory({ symbol: "THIN", volume: 100 }),
      onPaidCall: () => { paidCalls += 1; },
    }),
    batchStore: store,
    ticker: "THIN",
    runId: "direct-test",
  });

  assert.equal(result.status, "suppressed");
  assert.equal(result.source, "cache");
  assert.equal(result.claimAcquired, false);
  assert.equal(result.eligibilityCode, "insufficient_liquidity");
  assert.equal(claimCalls, 0);
  assert.equal(paidCalls, 0);
  assert.deepEqual(savedReasons, ["insufficient_liquidity"]);
});

test("post-claim durable suppression releases lease and prevents paid refresh", async () => {
  let claimCalls = 0;
  let releaseCalls = 0;
  let paidCalls = 0;
  const store = {
    configured: true,
    async tryClaimMarketHistoryRequest() {
      claimCalls += 1;
      return true;
    },
    async getReusableMarketHistorySuppression() {
      return {
        ticker: "STALE",
        provider: "twelve-data",
        ratingEligibilityCode: "insufficient_market_history",
        suppressionReason: "insufficient_market_history",
      };
    },
    async releaseMarketHistoryRequestClaim() {
      releaseCalls += 1;
      return true;
    },
    async saveMarketHistoryEvidence() { throw new Error("not expected"); },
  } as unknown as RatingBatchStore;

  const result = await loadDirectCompanyHistoryWithLease({
    marketProvider: provider({
      cached: buildHistory({ symbol: "STALE", latestDate: "2026-08-01" }),
      onPaidCall: () => { paidCalls += 1; },
    }),
    batchStore: store,
    ticker: "STALE",
    runId: "direct-test",
  });

  assert.equal(result.status, "suppressed");
  assert.equal(result.source, "persisted_suppression");
  assert.equal(result.claimAcquired, false);
  assert.equal(result.eligibilityCode, "insufficient_market_history");
  assert.equal(claimCalls, 1);
  assert.equal(releaseCalls, 1);
  assert.equal(paidCalls, 0);
});

test("denied lease reports in-progress without paid refresh", async () => {
  let paidCalls = 0;
  const store = {
    configured: true,
    async tryClaimMarketHistoryRequest() { return false; },
    async getReusableMarketHistorySuppression() { return null; },
    async releaseMarketHistoryRequestClaim() { throw new Error("not expected"); },
    async saveMarketHistoryEvidence() { throw new Error("not expected"); },
  } as unknown as RatingBatchStore;

  const result = await loadDirectCompanyHistoryWithLease({
    marketProvider: provider({
      cached: null,
      onPaidCall: () => { paidCalls += 1; },
    }),
    batchStore: store,
    ticker: "BUSY",
    runId: "direct-test",
  });

  assert.equal(result.status, "in_progress");
  assert.equal(result.claimAcquired, false);
  assert.equal(paidCalls, 0);
});

test("newly refreshed ineligible history is persisted and releases its lease", async () => {
  let releaseCalls = 0;
  let paidCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];
  const store = {
    configured: true,
    async tryClaimMarketHistoryRequest() { return true; },
    async getReusableMarketHistorySuppression() { return null; },
    async releaseMarketHistoryRequestClaim() {
      releaseCalls += 1;
      return true;
    },
    async saveMarketHistoryEvidence(evidence: MarketHistoryEvidence) {
      savedReasons.push(evidence.suppressionReason);
    },
  } as unknown as RatingBatchStore;

  const result = await loadDirectCompanyHistoryWithLease({
    marketProvider: provider({
      cached: null,
      refreshed: buildHistory({ symbol: "SHORT", bars: 30 }),
      onPaidCall: () => { paidCalls += 1; },
    }),
    batchStore: store,
    ticker: "SHORT",
    runId: "direct-test",
  });

  assert.equal(result.status, "suppressed");
  assert.equal(result.source, "paid_refresh");
  assert.equal(result.claimAcquired, false);
  assert.equal(result.eligibilityCode, "insufficient_market_history");
  assert.equal(paidCalls, 1);
  assert.equal(releaseCalls, 1);
  assert.deepEqual(savedReasons, ["insufficient_market_history"]);
});
