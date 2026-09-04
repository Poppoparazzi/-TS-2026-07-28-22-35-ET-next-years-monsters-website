// TS: 2026-09-04 06:01 ET

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

test("rating candidates defer known insufficient history using plausible market sessions and a provider cooldown", () => {
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /market_history_evidence_latest/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /company_id\s*=\s*c\.id/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /rating_history_ready\s*=\s*false/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /latest_bar_date/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /generate_series/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /EXTRACT\(ISODOW/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /BETWEEN\s+1\s+AND\s+5/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /253\s*-\s*mhe\.usable_bar_count/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /CEIL\(GREATEST\(253\s*-\s*mhe\.usable_bar_count,\s*0\)\s*\/\s*20\.0\)/i);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /CURRENT_TIMESTAMP\s*<\s*mhe\.retrieved_at\s*\+\s*INTERVAL\s+'30 days'/i);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /INTERVAL\s+'7 days'/i);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /latest_bar_date\s*\+\s*\(\(253\s*-\s*mhe\.usable_bar_count\)\s*\*\s*INTERVAL\s+'1 day'\)/i);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /quote/i);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /monster_rating_runs/i);
});
