// TS: 2026-09-12 00:08 UTC

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
  const staleRefreshGate = indexOrFail(
    helperSource,
    'evidence.suppressionReason === "stale_market_data"',
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
  assert.ok(cachedEvidence < staleRefreshGate, "Cached evidence must be classified before deciding whether refresh is required.");
  assert.ok(staleRefreshGate < cachedEvidencePersistence, "Stale cache evidence must escape to refresh before reusable suppression is persisted.");
});

test("cache preflight refreshes stale history without persisting a self-blocking suppression", async () => {
  const helperSource = await readFile(helperSourceUrl, "utf8");

  const staleGate = indexOrFail(
    helperSource,
    'if (evidence.suppressionReason === "stale_market_data")',
    "cached-company-history-preflight.ts",
  );
  const refreshReturn = indexOrFail(
    helperSource,
    "return Object.freeze({ history: null, evidence, shouldRefresh: true });",
    "cached-company-history-preflight.ts",
  );
  const evidencePersistence = indexOrFail(
    helperSource,
    "await batchStore.saveMarketHistoryEvidence(evidence)",
    "cached-company-history-preflight.ts",
  );
  const durableSuppressionGate = indexOrFail(
    helperSource,
    "if (evidence.suppressionReason)",
    "cached-company-history-preflight.ts",
  );

  assert.ok(staleGate < refreshReturn, "Stale cached evidence must explicitly select refresh.");
  assert.ok(refreshReturn < evidencePersistence, "The stale refresh return must occur before reusable evidence persistence.");
  assert.ok(evidencePersistence < durableSuppressionGate, "Decisive history/liquidity suppressions must still be persisted before they are returned.");
});

test("cache preflight still suppresses proven history/liquidity failures with machine-readable evidence", async () => {
  const [batchSource, helperSource] = await Promise.all([
    readFile(batchSourceUrl, "utf8"),
    readFile(helperSourceUrl, "utf8"),
  ]);

  indexOrFail(helperSource, "if (evidence.suppressionReason)", "cached-company-history-preflight.ts");
  indexOrFail(helperSource, "shouldRefresh: false", "cached-company-history-preflight.ts");
  indexOrFail(helperSource, "batchStore.saveMarketHistoryEvidence(evidence)", "cached-company-history-preflight.ts");
  indexOrFail(batchSource, 'suppressionStage: "cached_company_history_preflight"', "rating-batch.ts");
  indexOrFail(batchSource, "cachedCompanyPreflight.evidence.suppressionReason", "rating-batch.ts");
});
