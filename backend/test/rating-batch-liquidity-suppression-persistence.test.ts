// TS: 2026-09-06 09:57 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RATING_BATCH_PATH = new URL("../src/jobs/rating-batch.ts", import.meta.url);
const EVIDENCE_BUILDER_PATH = new URL("../src/ratings/market-history-evidence.ts", import.meta.url);
const EVIDENCE_PERSISTENCE_PATH = new URL("../src/database/market-history-evidence-persistence.ts", import.meta.url);

test("proven insufficient liquidity is persisted on the first provider-backed history save before Not Yet Rated continues", async () => {
  const [batchSource, evidenceSource] = await Promise.all([
    readFile(RATING_BATCH_PATH, "utf8"),
    readFile(EVIDENCE_BUILDER_PATH, "utf8"),
  ]);

  const evidenceBuild = batchSource.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history);");
  const durableSave = batchSource.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);");
  const eligibilityCheck = batchSource.indexOf("if (!rating.eligible)");
  const failureRecord = batchSource.indexOf("await recordFailure(failure, candidate.isProtected);", eligibilityCheck);
  const earlyContinue = batchSource.indexOf("continue;", failureRecord);

  assert.match(evidenceSource, /twentySessionAverageDollarVolume < MINIMUM_RATING_DOLLAR_VOLUME/);
  assert.match(evidenceSource, /insufficientLiquidity[\s\S]*\? "insufficient_liquidity"/);
  assert.ok(evidenceBuild >= 0, "provider-backed market-history evidence must be built before rating evaluation");
  assert.ok(durableSave > evidenceBuild, "provider-backed market-history evidence must be persisted immediately after it is built");
  assert.ok(eligibilityCheck > durableSave, "the first durable evidence save must occur before any Not Yet Rated return");
  assert.ok(failureRecord > eligibilityCheck, "run metadata must still record the engine rejection");
  assert.ok(earlyContinue > failureRecord, "candidate must not return before durable evidence and run metadata are recorded");

  const saveCalls = batchSource.match(/batchStore\.saveMarketHistoryEvidence\(/g) ?? [];
  assert.equal(saveCalls.length, 1, "paid market history must be persisted once, not rewritten after the rating engine rejects it");
});

test("persisted market-history suppression accepts only matching structural reason pairs", async () => {
  const source = await readFile(EVIDENCE_PERSISTENCE_PATH, "utf8");

  assert.match(source, /"insufficient_market_history" \| "insufficient_liquidity"/);
  assert.match(source, /row\.rating_eligibility_code === "insufficient_liquidity"[\s\S]*row\.suppression_reason === "insufficient_liquidity"/);
  assert.match(source, /evidence\.twentySessionAverageDollarVolume >= 1_000_000/);
  assert.match(source, /market_history_evidence_invalid_liquidity_suppression/);
});
