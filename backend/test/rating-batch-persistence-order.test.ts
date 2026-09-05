// TS: 2026-09-05 14:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);
const storeSourceUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating batch persists SEC evidence before requesting paid company history", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const saveCompany = source.indexOf("await persistenceStore.saveSecCompany(company);");
  const saveFilings = source.indexOf("await persistenceStore.saveSecFilings(company, filings);");
  const saveFacts = source.indexOf("await persistenceStore.saveSecFacts(facts);");
  const paidHistory = source.indexOf("history = await getPacedHistory(candidate.ticker, 300);");

  assert.ok(saveCompany >= 0, "SEC company persistence must remain present.");
  assert.ok(saveFilings >= 0, "SEC filing persistence must remain present.");
  assert.ok(saveFacts >= 0, "SEC facts persistence must remain present.");
  assert.ok(paidHistory >= 0, "Paid company-history request must remain present.");
  assert.ok(saveCompany < paidHistory, "Persist the SEC company before the paid history request.");
  assert.ok(saveFilings < paidHistory, "Persist SEC filings before the paid history request.");
  assert.ok(saveFacts < paidHistory, "Persist SEC facts before the paid history request.");
});

test("rating batch rechecks durable suppression immediately before a paid company-history request", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const benchmarkRequest = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300);');
  const paidHistory = source.indexOf("history = await getPacedHistory(candidate.ticker, 300);");
  const recheckMarker = "await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)";
  const firstCheck = source.indexOf(recheckMarker);
  const secondCheck = source.indexOf(recheckMarker, firstCheck + recheckMarker.length);

  assert.ok(firstCheck >= 0, "Initial durable market-history suppression check must remain present.");
  assert.ok(benchmarkRequest > firstCheck, "Initial suppression must be checked before benchmark loading.");
  assert.ok(secondCheck > benchmarkRequest, "Durable suppression must be checked again after benchmark loading.");
  assert.ok(secondCheck < paidHistory, "The second durable suppression check must happen immediately before paid company history.");
});

test("rating batch persists machine-readable candidate failures before early Not Yet Rated returns", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const storeSource = await readFile(storeSourceUrl, "utf8");

  assert.match(storeSource, /recordCandidateFailure\(/, "The production batch store must expose incremental failure persistence.");
  assert.match(storeSource, /jsonb_set\(/, "Incremental failures must be written into run metadata immediately.");

  const structuredReasonCodes = [
    "unresolved_sec_identity",
    "insufficient_financial_history",
    "stored_market_history_preflight",
    "rating_engine",
  ];

  for (const marker of structuredReasonCodes) {
    const markerIndex = source.indexOf(marker);
    assert.ok(markerIndex >= 0, `Structured failure marker ${marker} must remain present.`);
    const recordIndex = source.indexOf("await recordFailure(failure, candidate.isProtected);", markerIndex);
    const continueIndex = source.indexOf("continue;", markerIndex);
    assert.ok(recordIndex >= 0, `Structured failure ${marker} must be persisted.`);
    assert.ok(continueIndex >= 0, `Structured failure ${marker} must retain an early return.`);
    assert.ok(recordIndex < continueIndex, `Persist ${marker} before its early Not Yet Rated return.`);
  }
});