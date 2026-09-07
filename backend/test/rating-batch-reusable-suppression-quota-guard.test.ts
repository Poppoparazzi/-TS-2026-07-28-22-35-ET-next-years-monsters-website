// TS: 2026-09-07 12:57 ET

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

test("free reusable-suppression preflight and persisted candidate evidence happen before benchmark quota", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const firstPreflight = source.indexOf("if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;");
  const claim = source.indexOf("tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)");
  const paidCandidateHistory = source.indexOf("history = await getPacedHistory(candidate.ticker, 300)");
  const persistEvidence = source.indexOf("saveMarketHistoryEvidence(marketHistoryEvidence)");
  const evidenceSuppression = source.indexOf("if (marketHistoryEvidence.suppressionReason)");
  const benchmarkLoad = source.indexOf('getPacedHistory("SPY", 300)');

  assert.ok(firstPreflight >= 0, "expected a reusable suppression preflight");
  assert.ok(claim > firstPreflight, "atomic claim must follow the free reusable-suppression preflight");
  assert.ok(paidCandidateHistory > claim, "paid candidate history must remain behind the atomic claim");
  assert.ok(persistEvidence > paidCandidateHistory, "provider-backed candidate evidence must be durably persisted after the paid company request");
  assert.ok(evidenceSuppression > persistEvidence, "persisted candidate evidence must be evaluated before any early suppression return");
  assert.ok(benchmarkLoad > evidenceSuppression, "SPY benchmark quota must be deferred until candidate history survives suppression");

  const preflightOccurrences = source.match(/recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)/g) ?? [];
  assert.ok(preflightOccurrences.length >= 4, "expected suppression checks before SEC work, before claim, after claim, and after retry backoff");
});
