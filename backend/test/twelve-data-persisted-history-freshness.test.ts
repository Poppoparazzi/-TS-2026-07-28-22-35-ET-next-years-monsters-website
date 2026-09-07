// TS: 2026-09-07 17:59 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { BenchmarkHistoryCache } from "../src/database/benchmark-history-cache.js";
import type { DailyMarketHistory } from "../src/providers/types.js";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "persisted-history-freshness-test-secret";
const TTL_MS = 15 * 60 * 1_000;

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

function makeProviderValues(outputSize: number) {
  const start = new Date("2025-01-02T00:00:00.000Z");
  return Array.from({ length: outputSize }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
    const close = 200 + index;
    return {
      datetime: date.toISOString().slice(0, 10),
      open: String(close - 1),
      high: String(close + 1),
      low: String(close - 2),
      close: String(close),
      volume: String(2_000_000 + index),
    };
  });
}

test("persisted daily history keeps its original freshness deadline in memory", async () => {
  const originalFetch = globalThis.fetch;
  const originalDateNow = Date.now;
  const outputSize = 311;
  const baseNow = Date.parse("2026-09-07T21:00:00.000Z");
  const persistedHistory = makeHistory(
    "AGEFIX",
    outputSize,
    new Date(baseNow - TTL_MS + 1_000).toISOString(),
  );
  const values = makeProviderValues(outputSize);
  let getFreshCount = 0;
  let fetchCount = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh() {
      getFreshCount += 1;
      return getFreshCount === 1 ? persistedHistory : null;
    },
    async save() {},
  };

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ meta: { symbol: "AGEFIX" }, values }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    Date.now = () => baseNow;
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const first = await provider.getDailyHistory("AGEFIX", outputSize);
    assert.equal(first, persistedHistory);
    assert.equal(fetchCount, 0);

    Date.now = () => baseNow + 1_500;
    const second = await provider.getDailyHistory("AGEFIX", outputSize);

    assert.notEqual(second, persistedHistory);
    assert.equal(getFreshCount, 2);
    assert.equal(fetchCount, 1);
  } finally {
    Date.now = originalDateNow;
    globalThis.fetch = originalFetch;
  }
});

test("lease coordination failure spends zero Twelve Data daily-history calls", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh() {
      return null;
    },
    async save() {},
    async acquireRefreshLease() {
      throw new Error("database unavailable");
    },
    async releaseRefreshLease() {},
  };

  globalThis.fetch = (async () => {
    fetchCount += 1;
    throw new Error("paid provider fetch should not run");
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    await assert.rejects(
      provider.getDailyHistory("LEASEFAIL", 260),
      /refresh coordination is unavailable for LEASEFAIL/,
    );
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
