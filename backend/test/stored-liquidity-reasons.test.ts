// TS: 2026-08-30 04:10 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStoredLiquidity,
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
