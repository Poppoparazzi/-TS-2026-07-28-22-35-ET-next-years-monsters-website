// TS: 2026-09-09 08:06 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rating batch uses cache-only benchmark readiness without violating paid-call ordering", () => {
  const source = readFileSync(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");
  const providerFactory = readFileSync(new URL("../src/providers/index.ts", import.meta.url), "utf8");

  const claim = source.indexOf("const marketHistoryClaimed = await batchStore.tryClaimMarketHistoryRequest");
  const postClaimSuppression = source.indexOf("if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;", claim);
  const cachedBenchmarkRead = source.indexOf('marketProvider.getCachedDailyHistory("SPY", 300)');
  const cachedBenchmarkValidation = source.indexOf("validateBenchmarkHistory(cachedBenchmarkHistory)");
  const companyHistoryFetch = source.indexOf("history = await getPacedHistory(candidate.ticker, 300)");
  const evidenceBuild = source.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history)");
  const evidenceSave = source.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence)");
  const evidenceSuppression = source.indexOf("if (marketHistoryEvidence.suppressionReason)");
  const benchmarkFetch = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300)');
  const benchmarkValidation = source.indexOf("validateBenchmarkHistory(benchmarkHistory)");
  const ratingBuild = source.indexOf("const rating = calculateMonsterRatingV1");

  assert.ok(claim >= 0, "company paid-history claim must remain ahead of benchmark cache preflight");
  assert.ok(postClaimSuppression > claim, "durable company suppression must be rechecked after the paid-history claim");
  assert.ok(cachedBenchmarkRead > postClaimSuppression, "cache-only SPY readiness must wait until company claim and suppression gates survive");
  assert.ok(cachedBenchmarkValidation > cachedBenchmarkRead, "persisted SPY history must be validated before any company history purchase");
  assert.ok(companyHistoryFetch > cachedBenchmarkValidation, "known-bad persisted SPY must stop the batch before company-history quota is spent");
  assert.ok(evidenceBuild > companyHistoryFetch, "company market-history evidence must be built immediately after paid company history");
  assert.ok(evidenceSave > evidenceBuild, "company market-history evidence must be durably persisted before any eligibility return");
  assert.ok(evidenceSuppression > evidenceSave, "persisted company evidence must be checked for a machine-readable suppression reason");
  assert.ok(benchmarkFetch > evidenceSuppression, "a cache miss may spend SPY quota only after company history survives durable suppression");
  assert.ok(benchmarkValidation > benchmarkFetch, "paid benchmark history must be validated after it is fetched");
  assert.ok(ratingBuild > benchmarkValidation, "benchmark history must pass its readiness gate before rating calculation");

  assert.match(providerFactory, /getCachedDailyHistory:/, "production Twelve Data factory must expose a cache-only history read");
  assert.match(providerFactory, /benchmarkHistoryCache\.getFresh\(/, "cache-only history read must use persisted provider-scoped cache");
  assert.doesNotMatch(
    providerFactory.slice(providerFactory.indexOf("getCachedDailyHistory:")),
    /getDailyHistory\(/,
    "cache-only preflight must never invoke the paid provider history method",
  );
  assert.match(source, /usableBars\.length < 253/);
  assert.match(
    source,
    /\(calculatedTime - latestTime\) \/ \(24 \* 60 \* 60 \* 1_000\) > 7/,
    "benchmark freshness must remain capped at seven days even when the implementation computes age inline",
  );
});
