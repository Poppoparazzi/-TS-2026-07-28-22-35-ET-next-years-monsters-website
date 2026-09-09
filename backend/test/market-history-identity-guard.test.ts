// TS: 2026-09-09 11:57 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMarketHistoryIdentity,
  createMarketHistoryIdentityGuard,
} from "../src/providers/index.js";

function history(symbol: string, provider = "twelve-data") {
  return Object.freeze({
    symbol,
    provider,
    retrievedAt: "2026-09-09T14:00:00.000Z",
    feedDisclosure: "Identity-guard test history.",
    bars: Object.freeze([]),
  });
}

test("market history identity accepts the requested symbol from the active provider", () => {
  const expected = history("AAPL");
  assert.equal(assertMarketHistoryIdentity(expected, "aapl", "twelve-data"), expected);
});

test("market history identity rejects a paid response for the wrong symbol", () => {
  assert.throws(
    () => assertMarketHistoryIdentity(history("MSFT"), "AAPL", "twelve-data"),
    /symbol mismatch: requested AAPL, received MSFT/i,
  );
});

test("market history identity rejects a response attributed to another provider", () => {
  assert.throws(
    () => assertMarketHistoryIdentity(history("AAPL", "other-provider"), "AAPL", "twelve-data"),
    /provider mismatch.*expected twelve-data, received other-provider/i,
  );
});

test("one paid identity mismatch trips the circuit breaker before another provider call", async () => {
  let paidCalls = 0;
  const guardedHistory = createMarketHistoryIdentityGuard(
    "twelve-data",
    async (symbol: string) => {
      paidCalls += 1;
      return symbol === "AAPL" ? history("MSFT") : history(symbol);
    },
  );

  await assert.rejects(
    () => guardedHistory("AAPL", 300),
    /service unavailable after identity-integrity failure.*symbol mismatch.*requested AAPL, received MSFT/i,
  );
  await assert.rejects(
    () => guardedHistory("NVDA", 300),
    /service unavailable after identity-integrity failure.*requested AAPL, received MSFT/i,
  );

  assert.equal(paidCalls, 1, "the provider must not receive a second paid history request after identity corruption is detected");
});
