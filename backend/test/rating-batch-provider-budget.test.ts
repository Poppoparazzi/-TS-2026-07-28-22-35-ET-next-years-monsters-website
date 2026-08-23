// TS: 2026-08-23 12:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const RATING_BATCH_SOURCE = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("rating batch rejects insufficient SEC revenue history before paid market history", async () => {
  const source = await readFile(RATING_BATCH_SOURCE, "utf8");

  const secPersistenceIndex = source.indexOf("await persistenceStore.saveSecFacts(facts);");
  const annualFinancialsIndex = source.indexOf("const annualFinancials = buildAnnualFinancialPeriods(facts);");
  const annualRevenueGuardIndex = source.indexOf("annualRevenuePeriods.length < 2");
  const paidHistoryIndex = source.indexOf("const history = await getPacedHistory(candidate.ticker, 300);");

  assert.ok(secPersistenceIndex >= 0, "SEC facts must be persisted before rating qualification.");
  assert.ok(annualFinancialsIndex > secPersistenceIndex, "SEC annual-period qualification must follow SEC persistence.");
  assert.ok(annualRevenueGuardIndex > annualFinancialsIndex, "The minimum annual-revenue guard must remain present.");
  assert.ok(paidHistoryIndex > annualRevenueGuardIndex, "Paid market history must remain after the SEC revenue guard.");

  const guardedSection = source.slice(annualRevenueGuardIndex, paidHistoryIndex);
  assert.match(
    guardedSection,
    /continue;/,
    "Insufficient SEC revenue history must skip the candidate before a paid market-history request.",
  );
});
