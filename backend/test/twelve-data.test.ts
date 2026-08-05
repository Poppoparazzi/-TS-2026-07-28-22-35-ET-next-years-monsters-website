// TS: 2026-08-05 08:02 ET

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
      { status: 200, headers: { "content-type": "application/json" } },
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
    assert.match(quote.feedDisclosure, /^External Market Data · May Be Delayed\./);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data daily history is normalized, sorted, filtered, and secret-safe", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";

  globalThis.fetch = (async (input, init) => {
    requestedUrl = typeof input === "string" ? input : input.toString();
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return new Response(
      JSON.stringify({
        meta: {
          symbol: "AAPL",
          interval: "1day",
          currency: "USD",
          exchange: "NASDAQ",
          type: "Common Stock",
        },
        values: [
          {
            datetime: "2026-08-04",
            open: "215.00",
            high: "218.00",
            low: "214.50",
            close: "217.25",
            volume: "50000000",
          },
          {
            datetime: "2026-08-02",
            open: "0",
            high: "0",
            low: "0",
            close: "0",
            volume: "0",
          },
          {
            datetime: "2026-08-03",
            open: "211.00",
            high: "216.00",
            low: "210.00",
            close: "215.25",
            volume: "45000000",
          },
        ],
        status: "ok",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    const history = await provider.getDailyHistory("aapl", 260);
    const url = new URL(requestedUrl);

    assert.equal(url.pathname, "/time_series");
    assert.equal(url.searchParams.get("symbol"), "AAPL");
    assert.equal(url.searchParams.get("interval"), "1day");
    assert.equal(url.searchParams.get("outputsize"), "260");
    assert.equal(url.searchParams.get("order"), "asc");
    assert.equal(requestedUrl.includes(API_KEY), false);
    assert.equal(authorization, `apikey ${API_KEY}`);
    assert.equal(history.symbol, "AAPL");
    assert.equal(history.securityType, "Common Stock");
    assert.equal(history.bars.length, 2);
    assert.deepEqual(
      history.bars.map((bar) => bar.date),
      ["2026-08-03", "2026-08-04"],
    );
    assert.equal(history.bars[1]?.close, 217.25);
    assert.match(history.feedDisclosure, /^External Market Data · May Be Delayed\./);
    assert.equal(JSON.stringify(history).includes(API_KEY), false);
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
    await assert.rejects(
      provider.getDailyHistory("AAPL/../../secret"),
      /unsupported characters/i,
    );
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Twelve Data adapter refuses to invent missing quote or history values", async () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = (async () => {
    callCount += 1;
    return new Response(
      JSON.stringify(callCount === 1 ? { symbol: "AAPL", name: "Apple Inc" } : {
        meta: { symbol: "AAPL", interval: "1day" },
        values: [{ datetime: "2026-08-04", close: "0" }],
        status: "ok",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const provider = new TwelveDataMarketDataProvider(API_KEY);
    await assert.rejects(provider.getQuote("AAPL"), /No usable quote was returned/i);
    await assert.rejects(
      provider.getDailyHistory("AAPL"),
      /No usable daily market history was returned/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
