// TS: 2026-09-04 12:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RATING_BATCH_PATH = new URL("../src/jobs/rating-batch.ts", import.meta.url);
const EVIDENCE_PERSISTENCE_PATH = new URL("../src/database/market-history-evidence-persistence.ts", import.meta.url);

test("proven insufficient liquidity is persisted on provider-backed history before Not Yet Rated continues", async () => {
  const source = await readFile(RATING_BATCH_PATH, "utf8");
  const eligibilityCheck = source.indexOf('rating.eligibilityCode === "insufficient_liquidity"');
  const durableSave = source.indexOf('suppressionReason: "insufficient_liquidity" as const');
  const failureRecord = source.indexOf("await recordFailure(failure, candidate.isProtected);", durableSave);
  const earlyContinue = source.indexOf("continue;", failureRecord);

  assert.ok(eligibilityCheck >= 0, "rating engine must explicitly prove insufficient liquidity");
  assert.ok(durableSave > eligibilityCheck, "durable market-history suppression must follow the engine result");
  assert.ok(failureRecord > durableSave, "run metadata must be recorded after durable market-history suppression");
  assert.ok(earlyContinue > failureRecord, "candidate must not return early before both persistence layers complete");
});

test("persisted market-history suppression accepts only matching structural reason pairs", async () => {
  const source = await readFile(EVIDENCE_PERSISTENCE_PATH, "utf8");

  assert.match(source, /"insufficient_market_history" \| "insufficient_liquidity"/);
  assert.match(source, /row\.rating_eligibility_code === "insufficient_liquidity"[\s\S]*row\.suppression_reason === "insufficient_liquidity"/);
  assert.match(source, /evidence\.twentySessionAverageDollarVolume >= 1_000_000/);
  assert.match(source, /market_history_evidence_invalid_liquidity_suppression/);
});
