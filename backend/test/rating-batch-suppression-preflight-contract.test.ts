// TS: 2026-09-11 05:01 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RATING_BATCH_PATH = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("rating batch performs one stored-history suppression read after SEC preflight before company cache/paid-history work", async () => {
  const source = await readFile(RATING_BATCH_PATH, "utf8");
  const annualGate = source.indexOf("annualRevenuePeriods.length < 2");
  const cachePreflight = source.indexOf("const cachedCompanyPreflight = await inspectCachedCompanyHistory");
  const claim = source.indexOf("marketHistoryClaimed = await batchStore.tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)");
  assert.ok(annualGate >= 0 && cachePreflight > annualGate && claim > cachePreflight, "SEC annual-revenue gate, free company-cache preflight, and paid-history claim must all exist in order");

  const between = source.slice(annualGate, cachePreflight);
  const suppressionReads = between.match(/recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)/g) ?? [];
  assert.equal(suppressionReads.length, 1, "exactly one durable suppression lookup should occur after SEC eligibility and before free company-cache preflight");

  const postClaim = source.slice(claim, source.indexOf("let history: DailyMarketHistory", claim));
  assert.match(postClaim, /recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)/, "the post-claim race-closing suppression read must remain before any paid company-history fetch");
});
