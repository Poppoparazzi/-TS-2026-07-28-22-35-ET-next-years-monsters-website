// TS: 2026-08-30 18:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  STORED_LIQUIDITY_FUTURE_TOLERANCE_MS,
  STORED_LIQUIDITY_MAX_AGE_MS,
  compareStoredLiquidityPriority,
  evaluateStoredLiquidity,
} from "../src/policy/stored-liquidity.js";

const nowMs = Date.parse("2026-08-30T07:00:00.000Z");

test("fresh provider timestamp enables verified stored liquidity", () => {
  const result = evaluateStoredLiquidity({
    price: 25,
    volume: 400_000,
    providerTimestamp: new Date(nowMs - 60_000).toISOString(),
    retrievedAt: new Date(nowMs - 30_000).toISOString(),
  }, nowMs);

  assert.equal(result.fresh, true);
  assert.equal(result.dollarVolume, 10_000_000);
});

test("stale provider timestamp cannot gain liquidity priority", () => {
  const result = evaluateStoredLiquidity({
    price: 25,
    volume: 400_000,
    providerTimestamp: new Date(nowMs - STORED_LIQUIDITY_MAX_AGE_MS - 1).toISOString(),
    retrievedAt: new Date(nowMs).toISOString(),
  }, nowMs);

  assert.equal(result.fresh, false);
  assert.equal(result.dollarVolume, 10_000_000);
});

test("malformed provider timestamp fails closed while absent provider timestamp may use retrievedAt", () => {
  const malformed = evaluateStoredLiquidity({
    price: 25,
    volume: 400_000,
    providerTimestamp: "not-a-date",
    retrievedAt: new Date(nowMs).toISOString(),
  }, nowMs);
  const absent = evaluateStoredLiquidity({
    price: 25,
    volume: 400_000,
    retrievedAt: new Date(nowMs).toISOString(),
  }, nowMs);

  assert.equal(malformed.fresh, false);
  assert.equal(absent.fresh, true);
});

test("future-dated quotes beyond tolerance cannot gain liquidity priority", () => {
  const result = evaluateStoredLiquidity({
    price: 25,
    volume: 400_000,
    providerTimestamp: new Date(nowMs + STORED_LIQUIDITY_FUTURE_TOLERANCE_MS + 1).toISOString(),
  }, nowMs);

  assert.equal(result.fresh, false);
});

test("non-positive price or volume fails closed", () => {
  assert.equal(evaluateStoredLiquidity({ price: 0, volume: 100, retrievedAt: new Date(nowMs).toISOString() }, nowMs).fresh, false);
  assert.equal(evaluateStoredLiquidity({ price: 10, volume: 0, retrievedAt: new Date(nowMs).toISOString() }, nowMs).fresh, false);
});

test("fresh verified liquidity outranks deeper stale SEC evidence before paid calls", () => {
  const deepStale = {
    filingCount: 500,
    factCount: 5_000,
    ratingCount: 0,
    ticker: "DEEP",
    liquidity: evaluateStoredLiquidity({
      price: 500,
      volume: 10_000_000,
      providerTimestamp: new Date(nowMs - STORED_LIQUIDITY_MAX_AGE_MS - 1).toISOString(),
    }, nowMs),
  };
  const liquidShallow = {
    filingCount: 1,
    factCount: 1,
    ratingCount: 0,
    ticker: "LIQD",
    liquidity: evaluateStoredLiquidity({ price: 10, volume: 100_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };

  assert.ok(compareStoredLiquidityPriority(liquidShallow, deepStale) < 0);
});

test("higher fresh dollar volume outranks deeper evidence when both snapshots are fresh", () => {
  const deepLowerLiquidity = {
    filingCount: 100,
    factCount: 1_000,
    ratingCount: 0,
    ticker: "DEEP",
    liquidity: evaluateStoredLiquidity({ price: 10, volume: 100_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };
  const shallowHigherLiquidity = {
    filingCount: 1,
    factCount: 1,
    ratingCount: 0,
    ticker: "HIGH",
    liquidity: evaluateStoredLiquidity({ price: 25, volume: 400_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };

  assert.ok(compareStoredLiquidityPriority(shallowHigherLiquidity, deepLowerLiquidity) < 0);
});

test("filing and fact depth break ties after liquidity freshness and dollar volume", () => {
  const shallow = {
    filingCount: 1,
    factCount: 1,
    ratingCount: 0,
    ticker: "SHALLOW",
    liquidity: evaluateStoredLiquidity({ price: 25, volume: 400_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };
  const deep = {
    filingCount: 8,
    factCount: 20,
    ratingCount: 0,
    ticker: "DEEP",
    liquidity: evaluateStoredLiquidity({ price: 25, volume: 400_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };

  assert.ok(compareStoredLiquidityPriority(deep, shallow) < 0);
});
