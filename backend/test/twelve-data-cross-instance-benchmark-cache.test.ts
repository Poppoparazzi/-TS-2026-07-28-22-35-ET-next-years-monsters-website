// TS: 2026-09-07 08:03 ET

import assert from "node:assert/strict";
import test from "node:test";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "cross-instance-cache-test-secret";

test("separate Twelve Data provider instances share one in-flight SPY history request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  let releaseFetch!: () => void;
  const fetchGate = new Promise<void>((resolve) => {
    releaseFetch = resolve;
  });
  const start = new Date("2025-11-24T00:00:00.000Z");
  const values = Array.from({ length: 301 }, (_, index) => {
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
