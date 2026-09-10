// TS: 2026-09-10 01:57 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  REPLACEMENT_CLAIM_ELIGIBILITY_SQL,
} from "../src/universe/sec-batch-queue.js";

test("replacement claim accounting excludes protected SEC candidates", () => {
  assert.match(REPLACEMENT_CLAIM_ELIGIBILITY_SQL, /protected_priority = 1/);
});

test("replacement claim accounting only consumes first-attempt candidates", () => {
  assert.match(REPLACEMENT_CLAIM_ELIGIBILITY_SQL, /sec_attempt_count = 0/);
});
