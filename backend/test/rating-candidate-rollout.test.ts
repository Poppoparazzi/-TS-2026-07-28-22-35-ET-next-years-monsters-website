// TS: 2026-08-22 02:58 ET

import assert from "node:assert/strict";
import test from "node:test";
import { EXCLUDE_CURRENT_COMPLETED_RATING_SQL } from "../src/ratings/batch-store.js";

test("first-500 rollout excludes every completed current-version rating regardless of age", () => {
  assert.match(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /rating_version\s*=\s*\$2/i);
  assert.match(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /status\s*=\s*'complete'/i);
  assert.doesNotMatch(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /calculated_at/i);
  assert.doesNotMatch(EXCLUDE_CURRENT_COMPLETED_RATING_SQL, /interval\s+'20 hours'/i);
});
