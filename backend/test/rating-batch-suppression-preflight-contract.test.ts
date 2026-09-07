// TS: 2026-09-07 14:59 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RATING_BATCH_PATH = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("rating batch performs one stored-history suppression read after SEC preflight before the paid-history claim", async () => {
  const source = await readFile(RATING_BATCH_PATH, "utf8");
  const annualGate = source.indexOf("annualRevenuePeriods.length < 2");
  const claim = source.indexOf("const marketHistoryClaimed = await batchStore.tryClaimMarketHistoryRequest");
  assert.ok(annualGate >= 0 && claim > annualGate, "SEC annual-revenue gate and paid-history claim must both exist in order");

  const between = source.slice(annualGate, claim);
  const suppressionReads = between.match(/recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)/g) ?? [];
  assert.equal(suppressionReads.length, 1, "exactly one durable suppression lookup should occur after SEC eligibility and before the atomic paid-history claim");

  const postClaim = source.slice(claim, source.indexOf("let history: DailyMarketHistory", claim));
  assert.match(postClaim, /recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)/, "the post-claim race-closing suppression read must remain before any paid company-history fetch");
});
