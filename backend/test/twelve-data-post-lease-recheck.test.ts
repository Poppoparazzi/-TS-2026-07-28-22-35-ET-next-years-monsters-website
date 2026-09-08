// TS: 2026-09-08 01:58 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { BenchmarkHistoryCache } from "../src/database/benchmark-history-cache.js";
import type { DailyMarketHistory } from "../src/providers/types.js";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "post-lease-recheck-test-secret";

function makeHistory(symbol: string, outputSize: number): DailyMarketHistory {
  const start = new Date("2025-01-02T00:00:00.000Z");
  return Object.freeze({
    symbol,
    bars: Object.freeze(Array.from({ length: outputSize }, (_, index) => {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
      const close = 100 + index;
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 1_000_000 + index,
      });
    })),
    provider: "twelve-data",
    retrievedAt: new Date().toISOString(),
    feedDisclosure: "Test Twelve Data daily history.",
  });
}

test("fresh history persisted during lease race prevents duplicate Twelve Data fetch", async () => {
  const originalFetch = globalThis.fetch;
  const outputSize = 267;
  const racedHistory = makeHistory("LEASEWIN", outputSize);
  let getFreshCount = 0;
  let fetchCount = 0;
  let releaseCount = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh() {
      getFreshCount += 1;
      return getFreshCount === 1 ? null : racedHistory;
    },
    async save() {
      throw new Error("save should not run when raced history is reused");
    },
    async acquireRefreshLease() {
      return true;
    },
    async releaseRefreshLease() {
      releaseCount += 1;
    },
  };

  globalThis.fetch = (async () => {
    fetchCount += 1;
    throw new Error("paid provider fetch should not run");
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const history = await provider.getDailyHistory("LEASEWIN", outputSize);

    assert.equal(history, racedHistory);
    assert.equal(getFreshCount, 2);
    assert.equal(fetchCount, 0);
    assert.equal(releaseCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
