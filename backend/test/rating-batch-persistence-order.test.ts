// TS: 2026-08-25 18:19 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);

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
