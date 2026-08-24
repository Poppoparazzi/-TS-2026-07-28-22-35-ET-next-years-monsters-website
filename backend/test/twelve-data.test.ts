// TS: 2026-08-24 10:30 ET

import assert from "node:assert/strict";
import test from "node:test";
import { TwelveDataMarketDataProvider } from "../src/providers/twelve-data.js";

const API_KEY = "adapter-test-secret";

test("Twelve Data quote is normalized without putting the key in the URL or result", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";

  globalThis.fetch = (async (input, init) => {
    requestedUrl = typeof input === "string" ? input : input.toString();
    authorization = new Headers(init?.headers).get("authorization") ?? "";

    return new Response(
      JSON.stringify({
        symbol: "AAPL",
        name: "Apple Inc",
        exchange: "NASDAQ",
        currency: "USD",
        timestamp: 1_785_340_800,
        close: "215.75",
        volume: "45678901",
        change: "2.50",
        percent_change: "1.173",
        is_market_open: true,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    const quote = await provider.getQuote("aapl");

    assert.equal(requestedUrl.includes(API_KEY), false);
    assert.equal(authorization, `apikey ${API_KEY}`);
    assert.equal(quote.symbol, "AAPL");
    assert.equal(quote.companyName, "Apple Inc");
    assert.equal(quote.price, 215.75);
    assert.equal(quote.change, 2.5);
    assert.equal(quote.percentChange, 1.173);
    assert.equal(quote.volume, 45_678_901);
    assert.equal(quote.marketSession, "regular");
    assert.equal(quote.freshness, "near-live");
    assert.equal(quote.provider, "twelve-data");
    assert.equal(JSON.stringify(quote).includes(API_KEY), false);
    assert.match(quote.feedDisclosure, /not labeled as a full consolidated SIP quote/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data adapter preserves HTTP status and provider code on quota errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        status: "error",
        code: 429,
        message: "API credits exhausted for the current minute",
      }),
      {
        status: 429,
        headers: { "content-type": "application/json" },
      },
    )) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    await assert.rejects(
      provider.getQuote("AAPL"),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /API credits exhausted/i);
        assert.match(error.message, /HTTP 429/i);
        assert.match(error.message, /provider code 429/i);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data adapter rejects malformed symbols before making a request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  globalThis.fetch = (async () => {
    fetchCalled = true;
    throw new Error("Fetch should not be called for an invalid symbol.");
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    await assert.rejects(provider.getQuote("AAPL/../../secret"), /unsupported characters/i);
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data adapter refuses to invent a price when the provider omits one", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ symbol: "AAPL", name: "Apple Inc" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    await assert.rejects(provider.getQuote("AAPL"), /No usable quote was returned/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data daily history is normalized, ordered, and keeps the key out of the URL", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";
  const start = new Date("2025-12-05T00:00:00.000Z");
  const values = Array.from({ length: 260 }, (_, index) => {
    const date = new Date(start.getTime() + index * 24 * 60 * 60 * 1_000);
    const close = 100 + index;
    return {
      datetime: date.toISOString().slice(0, 10),
      open: String(close - 1),
      high: String(close + 1),
      low: String(close - 2),
      close: String(close),
      volume: String(1_000_000 + index),
    };
  }).reverse();

  globalThis.fetch = (async (input, init) => {
    requestedUrl = typeof input === "string" ? input : input.toString();
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(JSON.stringify({ meta: { symbol: "AAPL" }, values }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    const history = await provider.getDailyHistory("aapl", 260);

    assert.equal(requestedUrl.includes(API_KEY), false);
    assert.match(requestedUrl, /time_series/);
    assert.match(requestedUrl, /interval=1day/);
    assert.equal(authorization, `apikey ${API_KEY}`);
    assert.equal(history.symbol, "AAPL");
    assert.equal(history.bars.length, 260);
    assert.ok(history.bars[0]!.date < history.bars.at(-1)!.date);
    assert.equal(history.bars.at(-1)!.close, 359);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
