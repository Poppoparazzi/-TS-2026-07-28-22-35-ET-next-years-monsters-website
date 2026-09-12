// TS: 2026-09-12 12:00 UTC

import assert from "node:assert/strict";
import test from "node:test";
import {
  BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS,
  type BenchmarkHistoryCache,
} from "../src/database/benchmark-history-cache.js";
import type { DailyMarketHistory } from "../src/providers/types.js";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

function makeHistory(symbol: string, outputSize: number, retrievedAt: string): DailyMarketHistory {
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
    retrievedAt,
    feedDisclosure: "Test Twelve Data daily history.",
  });
}

test("persisted history older than 15 minutes but younger than 24 hours avoids a paid request", async () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const outputSize = 307;
  const now = Date.parse("2026-09-12T12:00:00.000Z");
  const persistedHistory = makeHistory(
    "DAYREUSE",
    outputSize,
    new Date(now - 2 * 60 * 60 * 1_000).toISOString(),
  );
  const observedMaxAges: number[] = [];
  let fetchCount = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh(_symbol, _provider, _outputSize, maxAgeMs = 0) {
      observedMaxAges.push(maxAgeMs);
      const retrievedAtMs = Date.parse(persistedHistory.retrievedAt);
      return now - retrievedAtMs <= maxAgeMs ? persistedHistory : null;
    },
    async save() {},
  };

  globalThis.fetch = (async () => {
    fetchCount += 1;
    throw new Error("paid Twelve Data request should not run");
  }) as typeof fetch;

  try {
    Date.now = () => now;
    const provider = new TwelveDataMarketDataProvider("persisted-24h-reuse-test-secret", persistedCache);
    const history = await provider.getDailyHistory("DAYREUSE", outputSize);

    assert.equal(history, persistedHistory);
    assert.equal(fetchCount, 0);
    assert.deepEqual(observedMaxAges, [BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS]);
    assert.equal(BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS, 24 * 60 * 60 * 1_000);
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
  }
});
