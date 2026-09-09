// TS: 2026-09-09 00:05 ET

import assert from "node:assert/strict";
import test from "node:test";
import { RATING_SUPPRESSION_OVERLAP_REPORT_SQL } from "../src/jobs/report-rating-suppression-overlap.js";

test("suppression overlap report is provider-scoped and deduplicates durable and recent machine-reason candidates", () => {
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /market_history_evidence_latest_by_provider/i);
  assert.doesNotMatch(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /FROM\s+market_history_evidence_latest\s+mhe/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /mhe\.provider\s*=\s*\$1/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /\$1::text\s+AS\s+provider/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /INNER\s+JOIN\s+companies/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /rating_history_ready\s*=\s*false/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /suppression_reason\s*=\s*'insufficient_liquidity'/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /metadata\s*->\s*'replaceable'/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /INTERVAL\s+'30 days'/i);
  assert.doesNotMatch(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /INTERVAL\s+'7 days'/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /DISTINCT\s+ON\s*\(ticker\)/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /bool_or\(durable\)/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /bool_or\(recent\)/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /overlap_candidate_count/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /durable_only_candidate_count/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /recent_only_candidate_count/i);
  assert.match(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /unique_candidate_count/i);
  assert.doesNotMatch(RATING_SUPPRESSION_OVERLAP_REPORT_SQL, /\b(?:update|delete|insert|alter|drop|truncate)\b/i);
});
