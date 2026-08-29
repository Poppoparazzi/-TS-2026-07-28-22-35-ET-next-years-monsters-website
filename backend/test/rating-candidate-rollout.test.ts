// TS: 2026-08-28 20:02 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  EXCLUDE_CURRENT_COMPLETED_RATING_SQL,
  EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL,
} from "../src/ratings/batch-store.js";

test("first-500 rollout excludes every completed current-version rating regardless of age", () => {
  assert.match(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /rating_version\s*=\s*\$2/i);
  assert.match(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /status\s*=\s*'complete'/i);
  assert.doesNotMatch(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /calculated_at/i);
  assert.doesNotMatch(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /interval\s+'20 hours'/i);
});

test("rating candidates do not rebuy company history already proven below the 253-bar gate", () => {
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /market_history_evidence_latest/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /company_id\s*=\s*c\.id/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /rating_history_ready\s*=\s*false/i);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /quote/i);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /monster_rating_runs/i);
});
