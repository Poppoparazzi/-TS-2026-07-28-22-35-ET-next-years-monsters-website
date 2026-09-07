// TS: 2026-09-07 12:57 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rating batch defers shared benchmark history until company evidence survives", () => {
  const source = readFileSync(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");

  const companyHistoryFetch = source.indexOf("history = await getPacedHistory(candidate.ticker, 300)");
  const evidenceBuild = source.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history)");
  const evidenceSave = source.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence)");
  const evidenceSuppression = source.indexOf("if (marketHistoryEvidence.suppressionReason)");
  const benchmarkFetch = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300)');
  const benchmarkValidation = source.indexOf("validateBenchmarkHistory(benchmarkHistory)");
  const ratingBuild = source.indexOf("const rating = calculateMonsterRatingV1");

  assert.ok(companyHistoryFetch >= 0, "rating batch must fetch company history after free preflight and the paid-request claim");
  assert.ok(evidenceBuild > companyHistoryFetch, "company market-history evidence must be built immediately after paid company history");
  assert.ok(evidenceSave > evidenceBuild, "company market-history evidence must be durably persisted before any eligibility return");
  assert.ok(evidenceSuppression > evidenceSave, "persisted company evidence must be checked for a machine-readable suppression reason");
  assert.ok(
    benchmarkFetch > evidenceSuppression,
    "SPY history must not consume provider quota until company history has been persisted and survived suppression",
  );
  assert.ok(benchmarkValidation > benchmarkFetch, "benchmark history must be validated after it is fetched");
  assert.ok(ratingBuild > benchmarkValidation, "benchmark history must pass its readiness gate before rating calculation");
  assert.match(source, /usableBars\.length < 253/);
  assert.match(
    source,
    /\(calculatedTime - latestTime\) \/ \(24 \* 60 \* 60 \* 1_000\) > 7/,
    "benchmark freshness must remain capped at seven days even when the implementation computes age inline",
  );
});
