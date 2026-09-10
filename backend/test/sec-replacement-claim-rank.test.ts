// TS: 2026-09-10 04:00 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  REPLACEMENT_CLAIM_ELIGIBILITY_SQL,
  SEC_REPLACEMENT_CONSUMED_FILTER_SQL,
} from "../src/universe/sec-batch-queue.js";

test("replacement claim accounting excludes protected SEC candidates", () => {
  assert.match(REPLACEMENT_CLAIM_ELIGIBILITY_SQL, /protected_priority = 1/);
});

test("replacement claim accounting only consumes first-attempt candidates", () => {
  assert.match(REPLACEMENT_CLAIM_ELIGIBILITY_SQL, /sec_attempt_count = 0/);
});

test("permanently unresolved replacement candidates release their replacement entitlement", () => {
  assert.match(SEC_REPLACEMENT_CONSUMED_FILTER_SQL, /replacement_attempted = true/);
  assert.match(SEC_REPLACEMENT_CONSUMED_FILTER_SQL, /sec_status <> 'unresolved'/);
});
