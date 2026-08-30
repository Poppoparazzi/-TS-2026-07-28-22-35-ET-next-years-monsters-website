// TS: 2026-08-30 06:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStoredLiquidity,
  selectStoredLiquidityQualificationPool,
  STORED_LIQUIDITY_MAX_AGE_MS,
  STORED_LIQUIDITY_FUTURE_TOLERANCE_MS,
} from "../src/policy/stored-liquidity.js";

const NOW = Date.parse("2026-08-30T08:10:00.000Z");

function iso(offsetMs: number): string {
  return new Date(NOW + offsetMs).toISOString();
}

test("emits stable machine-readable reasons for stored liquidity suppression", () => {
  assert.equal(
    evaluateStoredLiquidity({ price: 0, volume: 1_000, retrievedAt: iso(0) }, NOW).reason,
    "missing_quote_values",
  );

  assert.equal(
    evaluateStoredLiquidity({ price: 10, volume: 1_000 }, NOW).reason,
    "missing_timestamp",
  );

  assert.equal(
    evaluateStoredLiquidity({
      price: 10,
      volume: 1_000,
      providerTimestamp: "not-a-timestamp",
      retrievedAt: iso(0),
    }, NOW).reason,
    "malformed_provider_timestamp",
  );

  assert.equal(
    evaluateStoredLiquidity({
      price: 10,
      volume: 1_000,
      providerTimestamp: iso(-(STORED_LIQUIDITY_MAX_AGE_MS + 1)),
    }, NOW).reason,
    "stale_timestamp",
  );

  assert.equal(
    evaluateStoredLiquidity({
      price: 10,
      volume: 1_000,
      providerTimestamp: iso(STORED_LIQUIDITY_FUTURE_TOLERANCE_MS + 1),
    }, NOW).reason,
    "future_timestamp",
  );

  assert.equal(
    evaluateStoredLiquidity({
      price: 10,
      volume: 1_000,
      providerTimestamp: iso(-1_000),
    }, NOW).reason,
    "fresh",
  );
});

test("does not fall back to retrievedAt when providerTimestamp is present but malformed", () => {
  const evidence = evaluateStoredLiquidity({
    price: 25,
    volume: 2_000_000,
    providerTimestamp: "broken-provider-time",
    retrievedAt: iso(-1_000),
  }, NOW);

  assert.equal(evidence.fresh, false);
  assert.equal(evidence.reason, "malformed_provider_timestamp");
  assert.equal(evidence.timestampMs, null);
  assert.equal(evidence.dollarVolume, 50_000_000);
});

test("selects the bounded SEC qualification pool using fresh verified liquidity before slicing", () => {
  const freshLow = evaluateStoredLiquidity({
    price: 10,
    volume: 1_000,
    providerTimestamp: iso(-1_000),
  }, NOW);
  const freshHigh = evaluateStoredLiquidity({
    price: 50,
    volume: 1_000_000,
    providerTimestamp: iso(-1_000),
  }, NOW);
  const staleHuge = evaluateStoredLiquidity({
    price: 500,
    volume: 10_000_000,
    providerTimestamp: iso(-(STORED_LIQUIDITY_MAX_AGE_MS + 1)),
  }, NOW);

  const selected = selectStoredLiquidityQualificationPool([
    { ticker: "STALE", filingCount: 8, factCount: 50, ratingCount: 0, liquidity: staleHuge },
    { ticker: "LOW", filingCount: 8, factCount: 50, ratingCount: 0, liquidity: freshLow },
    { ticker: "HIGH", filingCount: 8, factCount: 50, ratingCount: 0, liquidity: freshHigh },
  ], 2);

  assert.deepEqual(selected.map((item) => item.ticker), ["HIGH", "LOW"]);
  assert.equal(Object.isFrozen(selected), true);
});

test("qualification pool selector preserves stronger SEC evidence ahead of liquidity", () => {
  const fresh = evaluateStoredLiquidity({
    price: 100,
    volume: 5_000_000,
    providerTimestamp: iso(-1_000),
  }, NOW);

  const selected = selectStoredLiquidityQualificationPool([
    { ticker: "MORE_FILINGS", filingCount: 9, factCount: 10, ratingCount: 0, liquidity: fresh },
    { ticker: "MORE_FACTS", filingCount: 8, factCount: 100, ratingCount: 0, liquidity: fresh },
  ], 1);

  assert.equal(selected[0]?.ticker, "MORE_FILINGS");
});
