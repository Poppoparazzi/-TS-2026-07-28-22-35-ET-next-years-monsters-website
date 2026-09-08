// TS: 2026-09-08 09:57 ET

import assert from "node:assert/strict";
import test from "node:test";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "completed-cache-behavior-test";

function buildValues(count: number, baseClose: number) {
  const start = new Date("2025-01-01T00:00:00.000Z");
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
    const close = baseClose + index;
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

test("completed 500-bar history satisfies a later 260-bar request without a second paid call", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  const requestedOutputSizes: number[] = [];

  globalThis.fetch = (async (input) => {
    fetchCount += 1;
    const url = new URL(typeof input === "string" ? input : input.toString());
    const outputSize = Number(url.searchParams.get("outputsize"));
    requestedOutputSizes.push(outputSize);

    return new Response(
      JSON.stringify({ meta: { symbol: "CACHE500" }, values: buildValues(outputSize, 100) }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    const larger = await provider.getDailyHistory("CACHE500", 500);
    const smaller = await provider.getDailyHistory("cache500", 260);

    assert.equal(larger.bars.length, 500);
    assert.equal(smaller.bars.length, 260);
    assert.equal(fetchCount, 1);
    assert.deepEqual(requestedOutputSizes, [500]);
    assert.equal(smaller.bars[0]!.date, larger.bars.at(-260)!.date);
    assert.equal(smaller.bars.at(-1)!.date, larger.bars.at(-1)!.date);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("completed 260-bar history never satisfies a later 500-bar request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;
  const requestedOutputSizes: number[] = [];

  globalThis.fetch = (async (input) => {
    fetchCount += 1;
    const url = new URL(typeof input === "string" ? input : input.toString());
    const outputSize = Number(url.searchParams.get("outputsize"));
    requestedOutputSizes.push(outputSize);

    return new Response(
      JSON.stringify({ meta: { symbol: "CACHE260" }, values: buildValues(outputSize, 500) }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    const smaller = await provider.getDailyHistory("CACHE260", 260);
    const larger = await provider.getDailyHistory("cache260", 500);

    assert.equal(smaller.bars.length, 260);
    assert.equal(larger.bars.length, 500);
    assert.equal(fetchCount, 2);
    assert.deepEqual(requestedOutputSizes, [260, 500]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
