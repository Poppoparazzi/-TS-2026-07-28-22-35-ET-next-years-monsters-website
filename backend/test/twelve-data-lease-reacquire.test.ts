// TS: 2026-09-08 04:58 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { BenchmarkHistoryCache } from "../src/database/benchmark-history-cache.js";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "lease-reacquire-test-secret";

test("waiting history request rechecks persistence before safely reacquiring the paid refresh lease", async () => {
  const originalFetch = globalThis.fetch;
  const outputSize = 70;
  let getFreshCount = 0;
  let acquireCount = 0;
  let saveCount = 0;
  let releaseCount = 0;
  let fetchCount = 0;

  const persistedCache: BenchmarkHistoryCache = {
    async getFresh() {
      getFreshCount += 1;
      return null;
    },
    async save() {
      saveCount += 1;
    },
    async acquireRefreshLease() {
      acquireCount += 1;
      return acquireCount >= 2;
    },
    async releaseRefreshLease() {
      releaseCount += 1;
    },
  };

  const start = new Date("2025-01-02T00:00:00.000Z");
  const values = Array.from({ length: outputSize }, (_, index) => {
    const close = 100 + index;
    return {
      datetime: new Date(start.getTime() + index * 24 * 60 * 60 * 1_000)
        .toISOString()
        .slice(0, 10),
      open: String(close - 1),
      high: String(close + 1),
      low: String(close - 2),
      close: String(close),
      volume: String(1_000_000 + index),
    };
  });

  globalThis.fetch = (async () => {
    fetchCount += 1;
    return new Response(
      JSON.stringify({ meta: { symbol: "HANDOFF" }, values }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY, persistedCache);
    const history = await provider.getDailyHistory("HANDOFF", outputSize);

    assert.equal(history.bars.length, outputSize);
    assert.equal(fetchCount, 1);
    assert.equal(saveCount, 1);
    assert.equal(releaseCount, 1);
    assert.equal(acquireCount, 2);
    assert.equal(getFreshCount, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});