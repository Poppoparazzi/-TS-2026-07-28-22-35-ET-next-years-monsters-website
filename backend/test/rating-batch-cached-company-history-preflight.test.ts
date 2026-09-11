// TS: 2026-09-11 01:04 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);

function indexOrFail(source: string, needle: string): number {
  const index = source.indexOf(needle);
  assert.notEqual(index, -1, `Expected rating-batch.ts to contain: ${needle}`);
  return index;
}

test("fresh provider-scoped cached company history is inspected before any paid company-history claim or call", async () => {
  const source = await readFile(sourceUrl, "utf8");

  const cachedRead = indexOrFail(
    source,
    "marketProvider.getCachedDailyHistory(candidate.ticker, 300)",
  );
  const cachedEvidence = indexOrFail(
    source,
    "buildMarketHistoryEvidence(cachedCompanyHistory)",
  );
  const cachedEvidencePersistence = indexOrFail(
    source,
    "batchStore.saveMarketHistoryEvidence(cachedCompanyHistoryEvidence)",
  );
  const claim = indexOrFail(
    source,
    "batchStore.tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)",
  );
  const paidHistory = indexOrFail(
    source,
    "getPacedHistory(candidate.ticker, 300)",
  );

  assert.ok(cachedRead < cachedEvidence, "Cached company history must be validated after the free cache read.");
  assert.ok(cachedEvidence < cachedEvidencePersistence, "Cached evidence must be persisted after validation.");
  assert.ok(cachedEvidencePersistence < claim, "Cached evidence must be persisted before the paid-request claim.");
  assert.ok(claim < paidHistory, "A paid company-history call must remain behind the atomic claim.");
});

test("cache preflight preserves refresh eligibility for stale history while suppressing proven history/liquidity failures", async () => {
  const source = await readFile(sourceUrl, "utf8");

  indexOrFail(source, "cachedCompanyHistoryEvidence.suppressionReason === \"stale_market_data\"");
  indexOrFail(source, "cachedCompanyHistory = null");
  indexOrFail(source, "cached_company_history_preflight");
  indexOrFail(source, "cachedCompanyHistoryEvidence.suppressionReason");
});
