// TS: 2026-09-06 02:03 ET

import assert from "node:assert/strict";
import test from "node:test";
import { RATING_SUPPRESSION_RECONCILIATION_SQL } from "../src/jobs/report-rating-suppression-reconciliation.js";

test("suppression reconciliation emits one authoritative machine-readable reason per candidate", () => {
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /market_history_evidence_latest/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /INNER\s+JOIN\s+companies/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /rating_history_ready\s*=\s*false/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /metadata\s*->\s*'replaceable'/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /INTERVAL\s+'30 days'/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /source_priority/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /DISTINCT\s+ON\s*\(ticker\)/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /ORDER\s+BY\s+ticker,\s*source_priority\s+ASC,\s*observed_at\s+DESC/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /persisted_market_history/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /legacy_unclassified/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /unique_suppressed_candidate_count/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /persisted_authoritative_count/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /recent_authoritative_count/i);
  assert.match(RATING_SUPPRESSION_RECONCILIATION_SQL, /reason_breakdown/i);
  assert.doesNotMatch(RATING_SUPPRESSION_RECONCILIATION_SQL, /\b(?:update|delete|insert|alter|drop|truncate)\b/i);
});
