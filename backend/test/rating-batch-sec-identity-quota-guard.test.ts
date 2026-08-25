// TS: 2026-08-25 18:20 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchPath = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("rating batch rejects SEC identity mismatches before paid market history", async () => {
  const source = await readFile(ratingBatchPath, "utf8");

  const persistFacts = source.indexOf("await persistenceStore.saveSecFacts(facts);");
  const identityGuard = source.indexOf("if (company.cik <= 0 || facts.cik !== company.cik)");
  const benchmarkHistory = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300);');
  const companyHistory = source.indexOf("history = await getPacedHistory(candidate.ticker, 300);");

  assert.ok(persistFacts >= 0, "SEC facts must be persisted before rating qualification");
  assert.ok(identityGuard > persistFacts, "SEC identity mismatch must be checked after genuine SEC evidence is persisted");
  assert.ok(benchmarkHistory > identityGuard, "SPY history must not be purchased before SEC identity agrees");
  assert.ok(companyHistory > identityGuard, "company market history must not be purchased before SEC identity agrees");

  assert.match(
    source,
    /Official SEC company identity does not match the company-facts identity\./,
    "identity mismatch should remain an explicit repair/replace reason",
  );
});
