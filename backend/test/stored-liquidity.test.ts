// TS: 2026-08-30 03:00 ET

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

test("pre-SEC priority keeps filing and fact depth ahead of liquidity", () => {
  const deepEvidence = {
    filingCount: 8,
    factCount: 20,
    ratingCount: 0,
    ticker: "DEEP",
    liquidity: evaluateStoredLiquidity({ price: 10, volume: 100_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };
  const liquidShallow = {
    filingCount: 7,
    factCount: 50,
    ratingCount: 0,
    ticker: "LIQD",
    liquidity: evaluateStoredLiquidity({ price: 100, volume: 10_000_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };

  assert.ok(compareStoredLiquidityPriority(deepEvidence, liquidShallow) < 0);
});

test("fresh verified liquidity outranks stale liquidity when SEC evidence depth ties", () => {
  const fresh = {
    filingCount: 8,
    factCount: 20,
    ratingCount: 0,
    ticker: "FRESH",
    liquidity: evaluateStoredLiquidity({ price: 25, volume: 400_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };
  const stale = {
    filingCount: 8,
    factCount: 20,
    ratingCount: 0,
    ticker: "STALE",
    liquidity: evaluateStoredLiquidity({
      price: 100,
      volume: 10_000_000,
      providerTimestamp: new Date(nowMs - STORED_LIQUIDITY_MAX_AGE_MS - 1).toISOString(),
    }, nowMs),
  };

  assert.ok(compareStoredLiquidityPriority(fresh, stale) < 0);
});

test("higher fresh dollar volume wins after evidence depth and freshness tie", () => {
  const lower = {
    filingCount: 8,
    factCount: 20,
    ratingCount: 0,
    ticker: "LOW",
    liquidity: evaluateStoredLiquidity({ price: 10, volume: 100_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };
  const higher = {
    filingCount: 8,
    factCount: 20,
    ratingCount: 0,
    ticker: "HIGH",
    liquidity: evaluateStoredLiquidity({ price: 25, volume: 400_000, retrievedAt: new Date(nowMs).toISOString() }, nowMs),
  };

  assert.ok(compareStoredLiquidityPriority(higher, lower) < 0);
});
