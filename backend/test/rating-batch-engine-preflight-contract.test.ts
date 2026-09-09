// TS: 2026-09-09 01:59 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);
const engineUrl = new URL("../src/ratings/engine-v1.ts", import.meta.url);
const inputBuilderUrl = new URL("../src/ratings/input-builder.ts", import.meta.url);

test("retryable rating ineligibility stays behind free SEC and persisted company-history preflight", async () => {
  const [batch, engine, inputBuilder] = await Promise.all([
    readFile(batchUrl, "utf8"),
    readFile(engineUrl, "utf8"),
    readFile(inputBuilderUrl, "utf8"),
  ]);

  const paidCompanyHistory = batch.indexOf("history = await getPacedHistory(candidate.ticker, 300);");
  const secIdentityGate = batch.indexOf("company.cik <= 0 || facts.cik !== company.cik");
  const annualFinancialGate = batch.indexOf("annualFinancials.length < 2 || annualRevenuePeriods.length < 2");
  const evidenceBuild = batch.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history);");
  const evidencePersist = batch.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);");
  const evidenceSuppression = batch.indexOf("if (marketHistoryEvidence.suppressionReason)");
  const benchmarkHistory = batch.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300);');
  const engineRating = batch.indexOf("calculateMonsterRatingV1(buildProductionRatingInput");

  assert.ok(paidCompanyHistory >= 0, "Paid company-history request must remain identifiable.");
  assert.ok(secIdentityGate >= 0 && secIdentityGate < paidCompanyHistory, "Resolve SEC identity before paid company history.");
  assert.ok(annualFinancialGate >= 0 && annualFinancialGate < paidCompanyHistory, "Reject insufficient annual SEC revenue history before paid company history.");
  assert.ok(evidenceBuild > paidCompanyHistory, "Build reusable evidence immediately from the paid company history result.");
  assert.ok(evidencePersist > evidenceBuild, "Persist provider-backed company-history evidence before using it as a gate.");
  assert.ok(evidenceSuppression > evidencePersist, "Persist machine-readable market-history evidence before an early Not Yet Rated return.");
  assert.ok(benchmarkHistory > evidenceSuppression, "Do not spend benchmark quota until the company survives reusable history/liquidity suppression.");
  assert.ok(engineRating > benchmarkHistory, "Run the rating engine only after the free/persisted qualification gates.");

  for (const retryableCode of [
    "unresolved_sec_identity",
    "provider_not_connected",
    "insufficient_financial_history",
    "insufficient_market_history",
    "stale_market_data",
  ]) {
    assert.match(engine, new RegExp(`eligibilityCode: \\"${retryableCode}\\"`), `Engine must still expose ${retryableCode}.`);
  }

  assert.match(
    inputBuilder,
    /securityType:\s*null/,
    "Batch production input currently has no security-type evidence; do not pretend unsupported-security preflight is available from SEC company mapping.",
  );
  assert.match(
    engine,
    /retryable:\s*input\.securityType\s*!==\s*\"unsupported\"/,
    "Unsupported security type remains the structural non-retryable engine case when security-type evidence exists.",
  );
});
