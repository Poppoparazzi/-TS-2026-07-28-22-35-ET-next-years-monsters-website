// TS: 2026-09-14 06:05 UTC

import assert from "node:assert/strict";
import test from "node:test";
import type { DailyMarketHistory, MarketDataProvider } from "../src/providers/types.js";
import type { RatingBatchStore } from "../src/ratings/batch-store.js";
import { loadDirectCompanyHistoryWithLease } from "../src/ratings/direct-company-history.js";

function history(symbol: string): DailyMarketHistory {
  return {
    symbol,
    provider: "twelve-data",
    retrievedAt: "2026-09-14T06:00:00.000Z",
    feedDisclosure: "test fixture",
    bars: Array.from({ length: 260 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 11, 29 + index)).toISOString().slice(0, 10),
      open: 99,
      high: 101,
      low: 98,
      close: 100,
      volume: 2_000_000,
    })),
  };
}

function provider(input: { ticker: string; failPaidFetch?: boolean }): MarketDataProvider {
  return {
    name: "twelve-data",
    configured: true,
    async searchTickers() { return []; },
    async getQuote() { throw new Error("not used"); },
    async getCachedDailyHistory() { return null; },
    async getDailyHistory() {
      if (input.failPaidFetch) throw new Error("provider failed");
      return history(input.ticker);
    },
  };
}

function store(input: { releaseCalls: { value: number } }): RatingBatchStore {
  return {
    configured: true,
    async tryClaimMarketHistoryRequest() { return true; },
    async getReusableMarketHistorySuppression() { return null; },
    async releaseMarketHistoryRequestClaim() {
      input.releaseCalls.value += 1;
      return true;
    },
    async saveMarketHistoryEvidence() {
      throw new Error("persistence failed");
    },
  } as unknown as RatingBatchStore;
}

test("paid history persistence failure keeps the lease to block immediate repeat spend", async () => {
  const releaseCalls = { value: 0 };

  await assert.rejects(
    loadDirectCompanyHistoryWithLease({
      marketProvider: provider({ ticker: "KEEP" }),
      batchStore: store({ releaseCalls }),
      ticker: "KEEP",
      runId: "persistence-failure-test",
    }),
    /persistence failed/,
  );

  assert.equal(releaseCalls.value, 0);
});

test("provider failure before any paid history result releases the lease for retry", async () => {
  const releaseCalls = { value: 0 };

  await assert.rejects(
    loadDirectCompanyHistoryWithLease({
      marketProvider: provider({ ticker: "RETRY", failPaidFetch: true }),
      batchStore: store({ releaseCalls }),
      ticker: "RETRY",
      runId: "provider-failure-test",
    }),
    /provider failed/,
  );

  assert.equal(releaseCalls.value, 1);
});
