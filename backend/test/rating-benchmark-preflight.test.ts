// TS: 2026-09-09 05:58 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rating batch proves shared benchmark readiness before paid company history", () => {
  const source = readFileSync(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");

  const secRevenuePreflight = source.indexOf("annualRevenuePeriods.length < 2");
  const reusableSuppression = source.indexOf("recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)", secRevenuePreflight);
  const benchmarkFetch = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300)');
  const benchmarkValidation = source.indexOf("validateBenchmarkHistory(benchmarkHistory)");
  const companyClaim = source.indexOf("tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)");
  const companyHistoryFetch = source.indexOf("history = await getPacedHistory(candidate.ticker, 300)");
  const evidenceBuild = source.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history)");
  const evidenceSave = source.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence)");
  const ratingBuild = source.indexOf("const rating = calculateMonsterRatingV1");

  assert.ok(secRevenuePreflight >= 0, "free SEC/revenue eligibility must run before benchmark quota is considered");
  assert.ok(reusableSuppression > secRevenuePreflight, "durable company suppression must be rechecked after free SEC preflight");
  assert.ok(benchmarkFetch > reusableSuppression, "SPY should only be loaded after a candidate survives free/durable preflight");
  assert.ok(benchmarkValidation > benchmarkFetch, "benchmark history must be validated immediately after loading");
  assert.ok(
    companyClaim > benchmarkValidation,
    "an unusable benchmark must stop the batch before claiming or buying candidate company history",
  );
  assert.ok(companyHistoryFetch > companyClaim, "paid company history must remain protected by its cross-worker claim");
  assert.ok(evidenceBuild > companyHistoryFetch, "company market-history evidence must be built immediately after paid company history");
  assert.ok(evidenceSave > evidenceBuild, "company market-history evidence must be durably persisted before any eligibility return");
  assert.ok(ratingBuild > evidenceSave, "rating calculation must occur only after reusable company evidence is persisted");
  assert.match(source, /usableBars\.length < 253/);
  assert.match(
    source,
    /\(calculatedTime - latestTime\) \/ \(24 \* 60 \* 60 \* 1_000\) > 7/,
    "benchmark freshness must remain capped at seven days",
  );
});
