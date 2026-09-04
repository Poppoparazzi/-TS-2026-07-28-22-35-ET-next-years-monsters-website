// TS: 2026-09-04 06:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  RATING_CANDIDATE_SUPPRESSION_REPORT_SQL,
  RATING_RECENT_FAILURE_REASON_REPORT_SQL,
} from "../src/jobs/report-rating-candidate-suppression.js";

test("suppression report uses the same 30-day window as persisted paid-call policy", () => {
  assert.match(
    RATING_CANDIDATE_SUPPRESSION_REPORT_SQL,
    /retrieved_at \+ INTERVAL '30 days'/,
    "Known insufficient market-history evidence must remain in the 30-day cooldown report window.",
  );
  assert.doesNotMatch(
    RATING_CANDIDATE_SUPPRESSION_REPORT_SQL,
    /INTERVAL '7 days'/,
    "The market-history suppression report must not regress to the old seven-day window.",
  );

  assert.match(
    RATING_RECENT_FAILURE_REASON_REPORT_SQL,
    /CURRENT_TIMESTAMP - INTERVAL '30 days'/,
    "Machine-readable candidate failures must be counted across the 30-day suppression window.",
  );
  assert.doesNotMatch(
    RATING_RECENT_FAILURE_REASON_REPORT_SQL,
    /INTERVAL '7 days'/,
    "The reason report must not silently undercount failures using the old seven-day window.",
  );
});
