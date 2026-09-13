// TS: 2026-09-13 23:02 UTC

import assert from "node:assert/strict";
import test from "node:test";
import type { MarketDataProvider, DailyMarketHistory } from "../src/providers/types.js";
import type { RatingBatchStore } from "../src/ratings/batch-store.js";
import {
  loadDirectCompanyHistoryQuotaSafe,
  loadDirectCompanyHistoryWithLease,
} from "../src/ratings/direct-company-history.js";
import type { MarketHistoryEvidence } from "../src/ratings/market-history-evidence.js";

function buildHistory(input: {
  symbol?: string;
  provider?: string;
  bars?: number;
  retrievedAt?: string;
  latestDate?: string;
  volume?: number;
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
    symbol: input.symbol ?? "CACHE",
    provider: input.provider ?? "twelve-data",
    bars,
    retrievedAt: input.retrievedAt ?? "2026-09-13T19:59:00.000Z",
    feedDisclosure: "test fixture",
  };
}

function providerWithCache(
  cache: DailyMarketHistory | null,
  paidHistory = buildHistory({ symbol: cache?.symbol ?? "CACHE" }),
  onPaidCall?: () => void,
): MarketDataProvider {
  return {
    name: "twelve-data",
    configured: true,
    async searchTickers() { return []; },
    async getQuote() { throw new Error("not used"); },
    async getCachedDailyHistory() { return cache; },
    async getDailyHistory() {
      onPaidCall?.();
      return paidHistory;
    },
  };
}

function batchStore(savedReasons: Array<string | null | undefined>): RatingBatchStore {
  return {
    configured: false,
    async saveMarketHistoryEvidence(evidence: MarketHistoryEvidence) {
      savedReasons.push(evidence.suppressionReason);
    },
  } as unknown as RatingBatchStore;
}

test("fresh provider-matching cached history skips paid refresh", async () => {
  let paidRefreshCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];
  const cached = buildHistory();

  const result = await loadDirectCompanyHistoryQuotaSafe({
    marketProvider: providerWithCache(cached),
    batchStore: batchStore(savedReasons),
    ticker: "CACHE",
    paidRefresh: async () => {
      paidRefreshCalls += 1;
      return buildHistory({ symbol: "CACHE" });
    },
  });

  assert.equal(result.source, "cache");
  assert.equal(result.history, cached);
  assert.equal(result.evidence?.suppressionReason, null);
  assert.equal(paidRefreshCalls, 0);
  assert.deepEqual(savedReasons, [null]);
});

test("decisive cached insufficient history skips paid refresh and persists the reason", async () => {
  let paidRefreshCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];

  const result = await loadDirectCompanyHistoryQuotaSafe({
    marketProvider: providerWithCache(buildHistory({ bars: 30 })),
    batchStore: batchStore(savedReasons),
    ticker: "SHORT",
    paidRefresh: async () => {
      paidRefreshCalls += 1;
      return buildHistory({ symbol: "SHORT" });
    },
  });

  assert.equal(result.source, "cache");
  assert.equal(result.history, null);
  assert.equal(result.evidence?.suppressionReason, "insufficient_market_history");
  assert.equal(paidRefreshCalls, 0);
  assert.deepEqual(savedReasons, ["insufficient_market_history"]);
});

test("stale cached evidence reaches exactly one paid refresh and does not persist stale suppression", async () => {
  let paidRefreshCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];

  const result = await loadDirectCompanyHistoryQuotaSafe({
    marketProvider: providerWithCache(buildHistory({ latestDate: "2026-08-01" })),
    batchStore: batchStore(savedReasons),
    ticker: "STALE",
    paidRefresh: async () => {
      paidRefreshCalls += 1;
      return buildHistory({ symbol: "STALE" });
    },
  });

  assert.equal(result.source, "paid_refresh");
  assert.equal(result.history?.symbol, "STALE");
  assert.equal(paidRefreshCalls, 1);
  assert.deepEqual(savedReasons, [null]);
});

test("provider-mismatched cache reaches exactly one paid refresh", async () => {
  let paidRefreshCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];

  const result = await loadDirectCompanyHistoryQuotaSafe({
    marketProvider: providerWithCache(buildHistory({ provider: "other-provider" })),
    batchStore: batchStore(savedReasons),
    ticker: "MISMATCH",
    paidRefresh: async () => {
      paidRefreshCalls += 1;
      return buildHistory({ symbol: "MISMATCH" });
    },
  });

  assert.equal(result.source, "paid_refresh");
  assert.equal(result.history?.symbol, "MISMATCH");
  assert.equal(paidRefreshCalls, 1);
  assert.deepEqual(savedReasons, [null]);
});

test("lease-safe loader uses fresh cache before any claim or paid provider call", async () => {
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
    marketProvider: providerWithCache(buildHistory({ symbol: "CACHE" }), undefined, () => {
      paidCalls += 1;
    }),
    batchStore: store,
    ticker: "CACHE",
    runId: "direct-test",
  });

  assert.equal(result.status, "ready");
  assert.equal(result.source, "cache");
  assert.equal(result.claimAcquired, false);
  assert.equal(claimCalls, 0);
  assert.equal(paidCalls, 0);
  assert.deepEqual(savedReasons, [null]);
});

test("lease-safe loader claims only after stale cache and retains claim for rating persistence", async () => {
  let claimCalls = 0;
  let releaseCalls = 0;
  let paidCalls = 0;
  const savedReasons: Array<string | null | undefined> = [];
  const store = {
    configured: true,
    async tryClaimMarketHistoryRequest() {
      claimCalls += 1;
      return true;
    },
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
    marketProvider: providerWithCache(
      buildHistory({ symbol: "STALE", latestDate: "2026-08-01" }),
      buildHistory({ symbol: "STALE" }),
      () => { paidCalls += 1; },
    ),
    batchStore: store,
    ticker: "STALE",
    runId: "direct-test",
  });

  assert.equal(result.status, "ready");
  assert.equal(result.source, "paid_refresh");
  assert.equal(result.claimAcquired, true);
  assert.equal(claimCalls, 1);
  assert.equal(paidCalls, 1);
  assert.equal(releaseCalls, 0);
  assert.deepEqual(savedReasons, [null]);
});
