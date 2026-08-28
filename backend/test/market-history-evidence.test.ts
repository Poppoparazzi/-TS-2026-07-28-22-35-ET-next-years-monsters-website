// TS: 2026-08-28 07:10 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketHistoryEvidence } from "../src/ratings/market-history-evidence.js";
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
  assert.equal(evidence.retrievedAt, history.retrievedAt);
  assert.equal(evidence.feedDisclosure, history.feedDisclosure);
});
