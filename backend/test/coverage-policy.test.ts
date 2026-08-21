// TS: 2026-08-21 15:16 UTC

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_SEC_TARGET,
  CANDIDATE_POOL_TARGET,
  evaluateCoverage,
} from "../src/universe/coverage-policy.js";

test("coverage policy measures a 2,200 evidence-ready target against 5,000 candidates", () => {
  const decision = evaluateCoverage({
    universeSize: 5_000,
    candidatesExaminedCount: 2_023,
    secEvidenceReadyCount: 1_774,
    protectedMustRepairCount: 2,
    replaceableFailureCount: 226,
  });

  assert.equal(ACTIVE_SEC_TARGET, 2_200);
  assert.equal(CANDIDATE_POOL_TARGET, 5_000);
  assert.equal(decision.targetSatisfied, false);
  assert.equal(decision.usableShortfall, 426);
  assert.equal(decision.reserveCandidateCount, 2_977);
  assert.equal(decision.substitutionEligibleCount, 226);
  assert.equal(decision.replacementsAttemptedCount, 0);
  assert.equal(decision.finalUsableUniverseCount, 1_774);
});

test("coverage policy treats overfill as reserve rather than failure", () => {
  const decision = evaluateCoverage({
    universeSize: 5_000,
    candidatesExaminedCount: 2_700,
    secEvidenceReadyCount: 2_275,
    protectedMustRepairCount: 0,
    replaceableFailureCount: 425,
  });

  assert.equal(decision.targetSatisfied, true);
  assert.equal(decision.usableShortfall, 0);
  assert.equal(decision.reserveCandidateCount, 2_300);
  assert.equal(decision.substitutionEligibleCount, 425);
  assert.equal(decision.replacementsAttemptedCount, 425);
  assert.equal(decision.finalUsableUniverseCount, 2_275);
});

test("protected must-repair stocks keep completion blocked above the numeric target", () => {
  const decision = evaluateCoverage({
    universeSize: 5_000,
    candidatesExaminedCount: 2_500,
    secEvidenceReadyCount: 2_300,
    protectedMustRepairCount: 1,
    replaceableFailureCount: 199,
  });

  assert.equal(decision.usableShortfall, 0);
  assert.equal(decision.targetSatisfied, false);
});
