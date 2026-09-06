// TS: 2026-09-06 08:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("all durable market-history suppression reasons stay machine-readable", async () => {
  const source = await readFile(sourceUrl, "utf8");
  for (const reason of [
    "insufficient_market_history",
    "insufficient_liquidity",
    "stale_market_data",
  ]) {
    assert.match(source, new RegExp(`suppressionReason === [\\\"']${reason}[\\\"']`));
  }
});

test("free reusable-suppression preflight happens before benchmark and paid candidate history", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const firstPreflight = source.indexOf("if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;");
  const benchmarkLoad = source.indexOf('getPacedHistory("SPY", 300)');
  const claim = source.indexOf("tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)");
  const paidCandidateHistory = source.indexOf("history = await getPacedHistory(candidate.ticker, 300)");

  assert.ok(firstPreflight >= 0, "expected a reusable suppression preflight");
  assert.ok(benchmarkLoad > firstPreflight, "suppression preflight must precede benchmark provider work");
  assert.ok(claim > benchmarkLoad, "claim must follow the free suppression preflight and benchmark validation");
  assert.ok(paidCandidateHistory > claim, "paid candidate history must remain behind the atomic claim");

  const preflightOccurrences = source.match(/recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)/g) ?? [];
  assert.ok(preflightOccurrences.length >= 4, "expected suppression checks before benchmark, before claim, after claim, and after retry backoff");
});
