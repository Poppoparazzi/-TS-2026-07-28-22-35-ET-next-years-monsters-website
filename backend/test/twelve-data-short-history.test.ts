// TS: 2026-09-12 05:01 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";
import { buildMarketHistoryEvidence } from "../src/ratings/market-history-evidence.js";

const API_KEY = "short-history-test-secret";

test("Twelve Data returns non-empty short history so it can be durably suppressed", async () => {
  const originalFetch = globalThis.fetch;
  const start = new Date("2026-07-01T00:00:00.000Z");
  const values = Array.from({ length: 40 }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
    const close = 20 + index;
    return {
      datetime: date.toISOString().slice(0, 10),
      open: String(close - 1),
      high: String(close + 1),
      low: String(close - 2),
      close: String(close),
      volume: "2000000",
    };
  });

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ meta: { symbol: "NEWCO" }, values }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    const history = await provider.getDailyHistory("NEWCO", 300);
    const evidence = buildMarketHistoryEvidence(history);

    assert.equal(history.symbol, "NEWCO");
    assert.equal(history.bars.length, 40);
    assert.equal(evidence.usableBarCount, 40);
    assert.equal(evidence.suppressionReason, "insufficient_market_history");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data still rejects a paid history response with zero usable bars", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ meta: { symbol: "EMPTY" }, values: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    await assert.rejects(
      provider.getDailyHistory("EMPTY", 300),
      /No usable daily market history was returned for EMPTY/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
