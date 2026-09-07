// TS: 2026-09-07 16:14 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { BenchmarkHistoryCache } from "../src/database/benchmark-history-cache.js";
import type { DailyMarketHistory } from "../src/providers/types.js";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "cross-instance-cache-test-secret";

function makeHistory(symbol: string, outputSize: number, retrievedAt: string): DailyMarketHistory {
  const start = new Date("2025-11-24T00:00:00.000Z");
  return Object.freeze({
    symbol,
    bars: Object.freeze(Array.from({ length: outputSize }, (_, index) => {
      const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
      const close = 600 + index;
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 20_000_000 + index,
      });
    })),
    provider: "twelve-data",
    retrievedAt,
    feedDisclosure: "Test Twelve Data daily history.",
  });
}

function makeProviderValues(outputSize: number) {
  const start = new Date("2025-11-24T00:00:00.000Z");
  return Array.from({ length: outputSize }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
    const close = 600 + index;
    return {
      datetime: date.toISOString().slice(0, 10),
      open: String(close - 1),
      high: String(close + 1),
      low: String(close - 2),
      close: String(close),
      volume: String(20_000_000 + index),
    };
  });
}

test("separate Twelve Data provider instances share one in-flight SPY history request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let releaseFetch!: () => void;
  const fetchGate = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  const values = makeProviderValues(301);

  globalThis.fetch = (async () => {
    fetchCount += 1;
    await fetchGate;
    return new Response(JSON.stringify({ meta: { symbol: "SPY" }, values }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const appProvider = new TwelveDataMarketDataProvider(API_KEY);
    const startupWorkerProvider = new TwelveDataMarketDataProvider(API_KEY);

    const appRequest = appProvider.getDailyHistory("SPY", 301);
    const workerRequest = startupWorkerProvider.getDailyHistory("spy", 301);

    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(fetchCount, 1);

    releaseFetch();
    const [appHistory, workerHistory] = await Promise.all([appRequest, workerRequest]);

    assert.equal(appHistory, workerHistory);
    assert.equal(appHistory.symbol, "SPY");
    assert.equal(appHistory.bars.length, 301);
    assert.equal(fetchCount, 1);

    const cachedHistory = await startupWorkerProvider.getDailyHistory("SPY", 301);
    assert.equal(cachedHistory, appHistory);
    assert.equal(fetchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fresh persisted SPY history avoids a paid provider fetch", async () => {
  const originalFetch = globalThis.fetch;
  const persistedHistory = makeHistory("SPY", 302, new Date().toISOString());
  let getFreshCount = 0;
  let saveCount = 0;
  let observedMaxAgeMs = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh(symbol, provider, outputSize, maxAgeMs) {
      getFreshCount += 1;
      observedMaxAgeMs = maxAgeMs ?? 0;
      assert.equal(symbol, "SPY");
      assert.equal(provider, "twelve-data");
      assert.equal(outputSize, 302);
      return persistedHistory;
    },
    async save() {
      saveCount += 1;
    },
  };

  globalThis.fetch = (async () => {
    throw new Error("fresh persisted benchmark history must avoid Twelve Data");
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const history = await provider.getDailyHistory("SPY", 302);

    assert.equal(history, persistedHistory);
    assert.equal(getFreshCount, 1);
    assert.equal(saveCount, 0);
    assert.equal(observedMaxAgeMs, 15 * 60 * 1_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing or expired persisted SPY history performs one paid fetch and refreshes persistence", async () => {
  const originalFetch = globalThis.fetch;
  const values = makeProviderValues(303);
  let fetchCount = 0;
  let getFreshCount = 0;
  const saved: Array<{ history: DailyMarketHistory; outputSize: number }> = [];

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh(symbol, provider, outputSize, maxAgeMs) {
      getFreshCount += 1;
      assert.equal(symbol, "SPY");
      assert.equal(provider, "twelve-data");
      assert.equal(outputSize, 303);
      assert.equal(maxAgeMs, 15 * 60 * 1_000);
      return null;
    },
    async save(history, outputSize) {
      saved.push({ history, outputSize });
    },
  };

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ meta: { symbol: "SPY" }, values }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const history = await provider.getDailyHistory("SPY", 303);

    assert.equal(getFreshCount, 1);
    assert.equal(fetchCount, 1);
    assert.equal(history.symbol, "SPY");
    assert.equal(history.bars.length, 303);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.history, history);
    assert.equal(saved[0]?.outputSize, 303);

    const cachedHistory = await provider.getDailyHistory("SPY", 303);
    assert.equal(cachedHistory, history);
    assert.equal(fetchCount, 1);
    assert.equal(getFreshCount, 1);
    assert.equal(saved.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fresh persisted company history avoids a repeat paid Twelve Data fetch after restart", async () => {
  const originalFetch = globalThis.fetch;
  const persistedHistory = makeHistory("AAPL", 304, new Date().toISOString());
  let getFreshCount = 0;
  let saveCount = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh(symbol, provider, outputSize, maxAgeMs) {
      getFreshCount += 1;
      assert.equal(symbol, "AAPL");
      assert.equal(provider, "twelve-data");
      assert.equal(outputSize, 304);
      assert.equal(maxAgeMs, 15 * 60 * 1_000);
      return persistedHistory;
    },
    async save() {
      saveCount += 1;
    },
  };

  globalThis.fetch = (async () => {
    throw new Error("fresh persisted company history must avoid a repeat Twelve Data purchase");
  }) as typeof fetch;

  try {
    const restartedWorkerProvider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const history = await restartedWorkerProvider.getDailyHistory("aapl", 304);

    assert.equal(history, persistedHistory);
    assert.equal(getFreshCount, 1);
    assert.equal(saveCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing persisted company history performs one paid fetch, persists it, then reuses it", async () => {
  const originalFetch = globalThis.fetch;
  const values = makeProviderValues(305);
  let fetchCount = 0;
  let getFreshCount = 0;
  const saved: Array<{ history: DailyMarketHistory; outputSize: number }> = [];

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh(symbol, provider, outputSize, maxAgeMs) {
      getFreshCount += 1;
      assert.equal(symbol, "MSFT");
      assert.equal(provider, "twelve-data");
      assert.equal(outputSize, 305);
      assert.equal(maxAgeMs, 15 * 60 * 1_000);
      return null;
    },
    async save(history, outputSize) {
      saved.push({ history, outputSize });
    },
  };

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ meta: { symbol: "MSFT" }, values }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const history = await provider.getDailyHistory("MSFT", 305);

    assert.equal(fetchCount, 1);
    assert.equal(getFreshCount, 1);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.history, history);
    assert.equal(saved[0]?.outputSize, 305);

    const reused = await provider.getDailyHistory("MSFT", 305);
    assert.equal(reused, history);
    assert.equal(fetchCount, 1);
    assert.equal(getFreshCount, 1);
    assert.equal(saved.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});