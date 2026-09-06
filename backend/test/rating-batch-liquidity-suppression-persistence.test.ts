// TS: 2026-09-06 10:57 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RATING_BATCH_PATH = new URL("../src/jobs/rating-batch.ts", import.meta.url);
const EVIDENCE_BUILDER_PATH = new URL("../src/ratings/market-history-evidence.ts", import.meta.url);
const EVIDENCE_PERSISTENCE_PATH = new URL("../src/database/market-history-evidence-persistence.ts", import.meta.url);

test("proven paid-history ineligibility is persisted once and short-circuits before rating or quote work", async () => {
  const [batchSource, evidenceSource] = await Promise.all([
    readFile(RATING_BATCH_PATH, "utf8"),
    readFile(EVIDENCE_BUILDER_PATH, "utf8"),
  ]);

  const evidenceBuild = batchSource.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history);");
  const durableSave = batchSource.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);");
  const suppressionCheck = batchSource.indexOf("if (marketHistoryEvidence.suppressionReason)", durableSave);
  const failureRecord = batchSource.indexOf("await recordFailure(failure, candidate.isProtected);", suppressionCheck);
  const earlyContinue = batchSource.indexOf("continue;", failureRecord);
  const ratingEvaluation = batchSource.indexOf("const rating = calculateMonsterRatingV1", durableSave);
  const quoteBuild = batchSource.indexOf("const quote = quoteFromDailyHistory", durableSave);

  assert.match(evidenceSource, /insufficientMarketHistory[\s\S]*\? "insufficient_market_history"/);
  assert.match(evidenceSource, /staleMarketData[\s\S]*\? "stale_market_data"/);
  assert.match(evidenceSource, /insufficientLiquidity[\s\S]*\? "insufficient_liquidity"/);
  assert.ok(evidenceBuild >= 0, "provider-backed market-history evidence must be built immediately after the paid response");
  assert.ok(durableSave > evidenceBuild, "provider-backed market-history evidence must be persisted immediately after it is built");
  assert.ok(suppressionCheck > durableSave, "durable suppression must be inspected only after the evidence save succeeds");
  assert.ok(failureRecord > suppressionCheck, "run metadata must record the same machine-readable suppression reason");
  assert.ok(earlyContinue > failureRecord, "suppressed provider history must exit before downstream rating work");
  assert.ok(ratingEvaluation > earlyContinue, "rating evaluation must not run for already-suppressed paid history");
  assert.ok(quoteBuild > earlyContinue, "quote construction/persistence must not run for already-suppressed paid history");
  assert.match(batchSource.slice(suppressionCheck, earlyContinue), /suppressionStage: "provider_market_history"/);
  assert.match(batchSource.slice(suppressionCheck, earlyContinue), /reasonCode: marketHistoryEvidence\.suppressionReason/);

  const saveCalls = batchSource.match(/batchStore\.saveMarketHistoryEvidence\(/g) ?? [];
  assert.equal(saveCalls.length, 1, "paid market history must be persisted once, not rewritten after ineligibility is proven");
});

test("persisted market-history suppression accepts only matching structural reason pairs", async () => {
  const source = await readFile(EVIDENCE_PERSISTENCE_PATH, "utf8");

  assert.match(source, /"insufficient_market_history" \| "insufficient_liquidity"/);
  assert.match(source, /row\.rating_eligibility_code === "insufficient_liquidity"[\s\S]*row\.suppression_reason === "insufficient_liquidity"/);
  assert.match(source, /evidence\.twentySessionAverageDollarVolume >= 1_000_000/);
  assert.match(source, /market_history_evidence_invalid_liquidity_suppression/);
});
