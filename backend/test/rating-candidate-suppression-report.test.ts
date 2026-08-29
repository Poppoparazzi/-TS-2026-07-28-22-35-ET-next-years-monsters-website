// TS: 2026-08-29 01:00 ET

import assert from "node:assert/strict";
import test from "node:test";
import { RATING_CANDIDATE_SUPPRESSION_REPORT_SQL } from "../src/jobs/report-rating-candidate-suppression.js";

test("candidate suppression report separates cooldown, session-gap, and retry-eligible histories", () => {
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /market_history_evidence_latest/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /rating_history_ready\s*=\s*false/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /INTERVAL\s+'7 days'/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /EXTRACT\(ISODOW/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /BETWEEN\s+1\s+AND\s+5/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /cooldown_suppressed_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /session_gap_suppressed_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /retry_eligible_count/i);
  assert.match(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /total_known_insufficient_count/i);
  assert.doesNotMatch(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL, /\b(?:update|delete|insert|alter|drop|truncate)\b/i);
});
