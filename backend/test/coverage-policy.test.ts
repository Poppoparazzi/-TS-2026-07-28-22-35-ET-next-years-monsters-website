// TS: 2026-08-17 09:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_SEC_TARGET,
  CANDIDATE_POOL_TARGET,
  evaluateCoverage,
} from "../src/universe/coverage-policy.js";

test("coverage policy measures the current 1774-complete shortfall", () => {
  const decision = evaluateCoverage({
    universeSize: 2_023,
    secCompleteCount: 1_774,
    unresolvedCount: 224,
    failedCount: 2,
  });

  assert.equal(ACTIVE_SEC_TARGET, 2_000);
  assert.equal(CANDIDATE_POOL_TARGET, 2_500);
  assert.equal(decision.targetSatisfied, false);
  assert.equal(decision.usableShortfall, 226);
  assert.equal(decision.reserveCandidateCount, 23);
  assert.equal(decision.substitutionEligibleCount, 226);
});

test("coverage policy treats overfill as reserve rather than failure", () => {
  const decision = evaluateCoverage({
    universeSize: 2_500,
    secCompleteCount: 2_075,
    unresolvedCount: 400,
    failedCount: 25,
  });

  assert.equal(decision.targetSatisfied, true);
  assert.equal(decision.usableShortfall, 0);
  assert.equal(decision.reserveCandidateCount, 500);
  assert.equal(decision.substitutionEligibleCount, 425);
});
