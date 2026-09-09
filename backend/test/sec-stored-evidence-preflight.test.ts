// TS: 2026-09-09 19:09 ET

import assert from "node:assert/strict";
import test from "node:test";
import { PROMOTE_STORED_SEC_EVIDENCE_SQL } from "../src/universe/sec-batch-queue.js";

test("stored SEC evidence is reconciled before another SEC network claim", () => {
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /sec_status IN \('queued', 'partial'\)/);
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /c\.sec_cik IS NOT NULL/);
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /FROM sec_filings sf/);
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /sf\.company_id = c\.id/);
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /FROM company_facts cf/);
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /cf\.company_id = c\.id/);
  assert.match(PROMOTE_STORED_SEC_EVIDENCE_SQL, /sec_status = 'complete'/);
});

test("stored-evidence reconciliation does not erase failure, unresolved, or stale repair states", () => {
  assert.doesNotMatch(PROMOTE_STORED_SEC_EVIDENCE_SQL, /'failed'/);
  assert.doesNotMatch(PROMOTE_STORED_SEC_EVIDENCE_SQL, /'unresolved'/);
  assert.doesNotMatch(PROMOTE_STORED_SEC_EVIDENCE_SQL, /'stale'/);
});
