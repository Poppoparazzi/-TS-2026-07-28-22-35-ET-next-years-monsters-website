// TS: 2026-09-07 12:57 ET

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

test("rating batch rechecks durable suppression around the paid company-history claim before benchmark quota", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const paidHistory = source.indexOf("history = await getPacedHistory(candidate.ticker, 300);");
  const claimRequest = source.indexOf("await batchStore.tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId);");
  const persistEvidence = source.indexOf("await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);");
  const evidenceSuppression = source.indexOf("if (marketHistoryEvidence.suppressionReason)");
  const benchmarkRequest = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300);');
  const recheckMarker = "await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)";
  const earlyCheck = source.indexOf(recheckMarker);
  const preClaimCheck = source.lastIndexOf(recheckMarker, claimRequest);
  const postClaimCheck = source.indexOf(recheckMarker, claimRequest);

  assert.ok(earlyCheck >= 0, "Initial durable market-history suppression check must remain present.");
  assert.ok(preClaimCheck > earlyCheck, "Durable suppression must be rechecked after free SEC qualification and before the paid-history claim.");
  assert.ok(preClaimCheck < claimRequest, "The final pre-claim durable suppression check must happen before atomic claim acquisition.");
  assert.ok(postClaimCheck > claimRequest, "Durable suppression must be checked again after claim acquisition.");
  assert.ok(postClaimCheck < paidHistory, "The post-claim durable suppression check must happen before paid company history.");
  assert.ok(paidHistory < persistEvidence, "Provider-backed company history must be persisted after the paid company request.");
  assert.ok(persistEvidence < evidenceSuppression, "Persist company evidence before its machine-readable suppression gate.");
  assert.ok(evidenceSuppression < benchmarkRequest, "Only company history that survives suppression may spend shared benchmark quota.");
});

test("rating batch persists machine-readable candidate failures before early Not Yet Rated returns", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const storeSource = await readFile(storeSourceUrl, "utf8");

  assert.match(storeSource, /recordCandidateFailure\(/, "The production batch store must expose incremental failure persistence.");
  assert.match(storeSource, /jsonb_set\(/, "Incremental failures must be written into run metadata immediately.");

  for (const marker of ["unresolved_sec_identity", "insufficient_financial_history", "rating_engine"]) {
    const markerIndex = source.indexOf(marker);
    assert.ok(markerIndex >= 0, `Structured failure marker ${marker} must remain present.`);
    const recordIndex = source.indexOf("await recordFailure(failure, candidate.isProtected);", markerIndex);
    const continueIndex = source.indexOf("continue;", markerIndex);
    assert.ok(recordIndex >= 0, `Structured failure ${marker} must be persisted.`);
    assert.ok(continueIndex >= 0, `Structured failure ${marker} must retain an early return.`);
    assert.ok(recordIndex < continueIndex, `Persist ${marker} before its early Not Yet Rated return.`);
  }

  const helperStart = source.indexOf("const recordReusableHistorySuppression = async");
  const helperEnd = source.indexOf("let examinedCount", helperStart);
  const storedStage = source.indexOf('suppressionStage: "stored_market_history_preflight"', helperStart);
  const storedRecord = source.indexOf("await recordFailure(failure, isProtected);", storedStage);
  const storedReturn = source.indexOf("return true;", storedRecord);
  const firstCaller = source.indexOf(
    "if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;",
    helperEnd,
  );

  assert.ok(helperStart >= 0 && helperEnd > helperStart, "Reusable suppression helper must remain present.");
  assert.ok(storedStage > helperStart && storedStage < helperEnd, "Stored-history failure must keep its machine-readable stage.");
  assert.ok(storedRecord > storedStage && storedRecord < helperEnd, "Stored-history suppression must be persisted inside the helper.");
  assert.ok(storedReturn > storedRecord && storedReturn < helperEnd, "Stored-history suppression must persist before the helper returns true.");
  assert.ok(firstCaller > helperEnd, "Candidate loop must short-circuit only after the helper has persisted the stored-history failure.");
});