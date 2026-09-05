// TS: 2026-09-05 15:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketHistoryEvidence,
  hasMinimumRatingHistoryEvidence,
  MINIMUM_RATING_HISTORY_BARS,
} from "../src/ratings/market-history-evidence.js";
import type { DailyMarketHistory } from "../src/providers/types.js";

test("counts only usable provider daily bars for rating preflight evidence", () => {
  const history: DailyMarketHistory = Object.freeze({
    symbol: "aapl",
    provider: "licensed-test-provider",
    retrievedAt: "2026-08-28T11:00:00.000Z",
    feedDisclosure: "test provider history",
    bars: Object.freeze([
      Object.freeze({ date: "2026-08-25", open: 100, high: 102, low: 99, close: 101, volume: 1_000_000 }),
      Object.freeze({ date: "2026-08-26", open: 101, high: 103, low: 100, close: 0, volume: 1_100_000 }),
      Object.freeze({ date: "2026-08-27", open: 102, high: 104, low: 101, close: 103, volume: -1 }),
      Object.freeze({ date: "2026-08-28", open: 103, high: 105, low: 102, close: 104, volume: 1_200_000 }),
    ]),
  });

  const evidence = buildMarketHistoryEvidence(history);
  assert.equal(evidence.symbol, "AAPL");
  assert.equal(evidence.provider, "licensed-test-provider");
  assert.equal(evidence.usableBarCount, 2);
  assert.equal(evidence.latestBarDate, "2026-08-28");
  assert.equal(evidence.suppressionReason, null);
  assert.equal(evidence.retrievedAt, history.retrievedAt);
  assert.equal(evidence.feedDisclosure, history.feedDisclosure);
  assert.equal(hasMinimumRatingHistoryEvidence(evidence), false);
});

test("computes twenty-session liquidity as the average of each session's close times volume", () => {
  const history: DailyMarketHistory = Object.freeze({
    symbol: "LIQ",
    provider: "licensed-test-provider",
    retrievedAt: "2026-09-05T19:00:00.000Z",
    feedDisclosure: "test provider history",
    bars: Object.freeze([
      Object.freeze({ date: "2026-09-03", open: 10, high: 10, low: 10, close: 10, volume: 100_000 }),
      Object.freeze({ date: "2026-09-04", open: 100, high: 100, low: 100, close: 100, volume: 10_000 }),
    ]),
  });

  const evidence = buildMarketHistoryEvidence(history);
  assert.equal(evidence.twentySessionAverageDollarVolume, 1_000_000);
});

test("marks provider history stale immediately after a paid response so it can be suppressed before a repeat call", () => {
  const history: DailyMarketHistory = Object.freeze({
    symbol: "oldc",
    provider: "licensed-test-provider",
    retrievedAt: "2026-09-04T23:01:00.000Z",
    feedDisclosure: "test provider history",
    bars: Object.freeze([
      Object.freeze({ date: "2026-08-20", open: 50, high: 51, low: 49, close: 50, volume: 500_000 }),
    ]),
  });

  const evidence = buildMarketHistoryEvidence(history);
  assert.equal(evidence.latestBarDate, "2026-08-20");
  assert.equal(evidence.suppressionReason, "stale_market_data");
});

test("rejects malformed and future-dated provider bars before readiness and liquidity evidence are computed", () => {
  const history: DailyMarketHistory = Object.freeze({
    symbol: "future",
    provider: "licensed-test-provider",
    retrievedAt: "2026-09-05T07:58:00.000Z",
    feedDisclosure: "test provider history",
    bars: Object.freeze([
      Object.freeze({ date: "2026-09-04", open: 100, high: 102, low: 99, close: 100, volume: 10_000 }),
      Object.freeze({ date: "2026-09-06", open: 100, high: 102, low: 99, close: 100, volume: 99_000_000 }),
      Object.freeze({ date: "not-a-date", open: 100, high: 102, low: 99, close: 100, volume: 99_000_000 }),
    ]),
  });

  const evidence = buildMarketHistoryEvidence(history);
  assert.equal(evidence.usableBarCount, 1);
  assert.equal(evidence.latestBarDate, "2026-09-04");
  assert.equal(evidence.twentySessionAverageDollarVolume, 1_000_000);
  assert.equal(hasMinimumRatingHistoryEvidence(evidence), false);
});

test("uses the rating engine's 253-session minimum for persisted preflight evidence", () => {
  assert.equal(MINIMUM_RATING_HISTORY_BARS, 253);

  const base = {
    symbol: "AAPL",
    provider: "licensed-test-provider",
    latestBarDate: "2026-08-28",
    retrievedAt: "2026-08-28T13:00:00.000Z",
    feedDisclosure: "test provider history",
  } as const;

  assert.equal(hasMinimumRatingHistoryEvidence({ ...base, usableBarCount: 252 }), false);
  assert.equal(hasMinimumRatingHistoryEvidence({ ...base, usableBarCount: 253 }), true);
  assert.equal(hasMinimumRatingHistoryEvidence({ ...base, usableBarCount: 300 }), true);
});
