// TS: 2026-08-10 10:18 UTC

import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyCurrentQuoteEvidence,
  verifyMarketEvidence,
} from "../src/ratings/market-evidence.js";

test("verified market evidence preserves provider provenance and sorted bars", () => {
  const result = verifyMarketEvidence({
    providerName: "Licensed Provider",
    providerConfigured: true,
    fetchedAt: "2026-08-09T19:55:00Z",
    symbol: " aapl ",
    bars: [
      { date: "2026-08-08", close: 201, volume: 2_000_000 },
      { date: "2026-08-07", close: 199, volume: 1_500_000 },
    ],
  });

  assert.equal(result.verified, true);
  if (!result.verified) return;
  assert.equal(result.evidence.symbol, "AAPL");
  assert.equal(result.evidence.providerName, "Licensed Provider");
  assert.equal(result.evidence.latestObservationDate, "2026-08-08");
  assert.deepEqual(result.evidence.bars.map((bar) => bar.date), ["2026-08-07", "2026-08-08"]);
});

test("market evidence fails closed when provider provenance is absent", () => {
  const result = verifyMarketEvidence({
    providerName: null,
    providerConfigured: false,
    fetchedAt: "2026-08-09T19:55:00Z",
    symbol: "AAPL",
    bars: [{ date: "2026-08-08", close: 201, volume: 2_000_000 }],
  });

  assert.deepEqual(result, {
    verified: false,
    reason: "provider_not_connected",
    missingEvidence: ["licensed market-data provider", "provider provenance"],
  });
});

test("market evidence rejects malformed observations instead of coercing them", () => {
  const result = verifyMarketEvidence({
    providerName: "Licensed Provider",
    providerConfigured: true,
    fetchedAt: "2026-08-09T19:55:00Z",
    symbol: "AAPL",
    bars: [
      { date: "not-a-date", close: 201, volume: 2_000_000 },
      { date: "2026-08-08", close: 0, volume: 2_000_000 },
      { date: "2026-08-07", close: 199, volume: -1 },
    ],
  });

  assert.deepEqual(result, {
    verified: false,
    reason: "no_valid_market_bars",
    missingEvidence: ["verified closing-price history", "verified volume history"],
  });
});

test("duplicate market dates resolve deterministically to the last explicit observation", () => {
  const result = verifyMarketEvidence({
    providerName: "Licensed Provider",
    providerConfigured: true,
    fetchedAt: "2026-08-09T19:55:00Z",
    symbol: "AAPL",
    bars: [
      { date: "2026-08-08", close: 200, volume: 1_000_000 },
      { date: "2026-08-08T21:00:00Z", close: 201, volume: 2_000_000 },
    ],
  });

  assert.equal(result.verified, true);
  if (!result.verified) return;
  assert.equal(result.evidence.bars.length, 1);
  assert.equal(result.evidence.bars[0]?.close, 201);
  assert.equal(result.evidence.bars[0]?.volume, 2_000_000);
});

test("current quote verifies positive price, provenance, identity, and freshness", () => {
  const result = verifyCurrentQuoteEvidence(
    {
      providerName: "Licensed Provider",
      providerConfigured: true,
      symbol: " aapl ",
      price: 203.25,
      observedAt: "2026-08-10T10:00:00Z",
      fetchedAt: "2026-08-10T10:01:00Z",
    },
    "2026-08-10T10:02:00Z",
  );

  assert.equal(result.verified, true);
  if (!result.verified) return;
  assert.equal(result.evidence.symbol, "AAPL");
  assert.equal(result.evidence.price, 203.25);
  assert.equal(result.evidence.providerName, "Licensed Provider");
});

test("current quote fails closed when provider is not connected", () => {
  const result = verifyCurrentQuoteEvidence(
    {
      providerName: null,
      providerConfigured: false,
      symbol: "AAPL",
      price: 203.25,
      observedAt: "2026-08-10T10:00:00Z",
      fetchedAt: "2026-08-10T10:01:00Z",
    },
    "2026-08-10T10:02:00Z",
  );

  assert.equal(result.verified, false);
  if (result.verified) return;
  assert.equal(result.reason, "provider_not_connected");
});

test("current quote rejects non-positive or non-finite prices", () => {
  const result = verifyCurrentQuoteEvidence(
    {
      providerName: "Licensed Provider",
      providerConfigured: true,
      symbol: "AAPL",
      price: 0,
      observedAt: "2026-08-10T10:00:00Z",
      fetchedAt: "2026-08-10T10:01:00Z",
    },
    "2026-08-10T10:02:00Z",
  );

  assert.equal(result.verified, false);
  if (result.verified) return;
  assert.equal(result.reason, "invalid_quote_price");
});

test("current quote rejects impossible future timestamp ordering", () => {
  const result = verifyCurrentQuoteEvidence(
    {
      providerName: "Licensed Provider",
      providerConfigured: true,
      symbol: "AAPL",
      price: 203.25,
      observedAt: "2026-08-10T10:05:00Z",
      fetchedAt: "2026-08-10T10:01:00Z",
    },
    "2026-08-10T10:02:00Z",
  );

  assert.equal(result.verified, false);
  if (result.verified) return;
  assert.equal(result.reason, "quote_from_future");
});

test("current quote rejects evidence outside the versioned market freshness window", () => {
  const result = verifyCurrentQuoteEvidence(
    {
      providerName: "Licensed Provider",
      providerConfigured: true,
      symbol: "AAPL",
      price: 203.25,
      observedAt: "2026-08-01T10:00:00Z",
      fetchedAt: "2026-08-01T10:01:00Z",
    },
    "2026-08-10T10:02:00Z",
  );

  assert.equal(result.verified, false);
  if (result.verified) return;
  assert.equal(result.reason, "stale_quote");
});
