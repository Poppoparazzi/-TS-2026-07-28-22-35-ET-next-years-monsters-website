// TS: 2026-09-06 09:57 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchSource = await readFile(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");

test("paid candidate history evidence is persisted once before eligibility returns", () => {
  const evidenceBuildIndex = ratingBatchSource.indexOf("const marketHistoryEvidence = buildMarketHistoryEvidence(history);");
  const evidenceSaveIndex = ratingBatchSource.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);");
  const eligibilityIndex = ratingBatchSource.indexOf("if (!rating.eligible)");

  assert.ok(evidenceBuildIndex >= 0, "rating batch must build durable provider-backed market-history evidence");
  assert.ok(evidenceSaveIndex > evidenceBuildIndex, "evidence must be persisted immediately after it is built");
  assert.ok(eligibilityIndex > evidenceSaveIndex, "evidence must be persisted before any rating-engine Not Yet Rated return");

  const evidenceSaveCalls = ratingBatchSource.match(/batchStore\.saveMarketHistoryEvidence\(/g) ?? [];
  assert.equal(
    evidenceSaveCalls.length,
    1,
    "rating batch must not rewrite the same paid-history evidence after the first durable save",
  );

  assert.doesNotMatch(
    ratingBatchSource,
    /rating\.eligibilityCode === "insufficient_liquidity"[\s\S]{0,500}saveMarketHistoryEvidence/,
    "low-liquidity rejection must rely on the first evidence save, which already carries insufficient_liquidity",
  );
});
