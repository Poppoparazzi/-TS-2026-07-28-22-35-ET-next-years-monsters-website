// TS: 2026-09-11 05:01 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchSourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);
const helperSourceUrl = new URL("../src/ratings/cached-company-history-preflight.ts", import.meta.url);

function indexOrFail(source: string, needle: string, label: string): number {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `Expected ${label} to contain: ${needle}`);
  return index;
}

test("fresh provider-scoped cached company history is inspected before any paid company-history claim or call", async () => {
  const [batchSource, helperSource] = await Promise.all([
    readFile(batchSourceUrl, "utf8"),
    readFile(helperSourceUrl, "utf8"),
  ]);

  const helperCall = indexOrFail(batchSource, "inspectCachedCompanyHistory(", "rating-batch.ts");
  const claim = indexOrFail(
    batchSource,
    "marketHistoryClaimed = await batchStore.tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)",
    "rating-batch.ts",
  );
  const paidHistory = indexOrFail(
    batchSource,
    "history = await getPacedHistory(candidate.ticker, 300)",
    "rating-batch.ts",
  );

  const cachedRead = indexOrFail(
    helperSource,
    "marketProvider.getCachedDailyHistory(ticker, 300)",
    "cached-company-history-preflight.ts",
  );
  const providerScope = indexOrFail(
    helperSource,
    "cachedCompanyHistory.provider !== marketProvider.name",
    "cached-company-history-preflight.ts",
  );
  const cachedEvidence = indexOrFail(
    helperSource,
    "buildMarketHistoryEvidence(cachedCompanyHistory)",
    "cached-company-history-preflight.ts",
  );
  const cachedEvidencePersistence = indexOrFail(
    helperSource,
    "batchStore.saveMarketHistoryEvidence(evidence)",
    "cached-company-history-preflight.ts",
  );

  assert.ok(helperCall < claim, "Free cached company-history preflight must run before the paid-request claim.");
  assert.ok(claim < paidHistory, "A paid company-history call must remain behind the atomic claim.");
  assert.ok(cachedRead < providerScope, "Cached history must be provider-scoped immediately after the free read.");
  assert.ok(providerScope < cachedEvidence, "Provider identity must be validated before cached evidence is derived.");
  assert.ok(cachedEvidence < cachedEvidencePersistence, "Cached evidence must be persisted after validation.");
});

test("cache preflight preserves refresh eligibility for stale history while suppressing proven history/liquidity failures", async () => {
  const [batchSource, helperSource] = await Promise.all([
    readFile(batchSourceUrl, "utf8"),
    readFile(helperSourceUrl, "utf8"),
  ]);

  indexOrFail(helperSource, 'evidence.suppressionReason === "stale_market_data"', "cached-company-history-preflight.ts");
  indexOrFail(helperSource, "shouldRefresh: true", "cached-company-history-preflight.ts");
  indexOrFail(helperSource, "if (evidence.suppressionReason)", "cached-company-history-preflight.ts");
  indexOrFail(helperSource, "shouldRefresh: false", "cached-company-history-preflight.ts");
  indexOrFail(batchSource, 'suppressionStage: "cached_company_history_preflight"', "rating-batch.ts");
  indexOrFail(batchSource, "cachedCompanyPreflight.evidence.suppressionReason", "rating-batch.ts");
});
