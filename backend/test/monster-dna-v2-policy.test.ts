// TS: 2026-10-01 07:20 ET

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMonsterDnaV2 } from "../src/ratings/monster-dna-v2-policy.js";

const ready = Object.freeze({
  earningsGuidanceCurrent: true,
  valuationExpectationsCurrent: true,
  marketEvidenceCurrent: true,
  unresolvedCriticalEvidenceConflict: false,
});

test("Monster DNA V2 blocks a great business when expectations fail", () => {
  const result = evaluateMonsterDnaV2({
    pillars: {
      businessDna: 94,
      inflectionExpectations: 42,
      marketConfirmation: 70,
    },
    antiDnaPenalty: 0,
    readiness: ready,
  });

  assert.equal(result.activeCandidate, false);
  assert.ok(result.failedGates.includes("inflection_expectations"));
  assert.ok(result.failedGates.includes("adjusted_score"));
});

test("Monster DNA V2 allows an active candidate only when every hard gate passes", () => {
  const result = evaluateMonsterDnaV2({
    pillars: {
      businessDna: 86,
      inflectionExpectations: 82,
      marketConfirmation: 78,
    },
    antiDnaPenalty: 0,
    readiness: ready,
  });

  assert.equal(result.adjustedScore, 82.6);
  assert.equal(result.activeCandidate, true);
  assert.deepEqual(result.failedGates, []);
});

test("Monster DNA V2 refuses stale evidence even when the numerical score is high", () => {
  const result = evaluateMonsterDnaV2({
    pillars: {
      businessDna: 95,
      inflectionExpectations: 90,
      marketConfirmation: 88,
    },
    antiDnaPenalty: 0,
    readiness: {
      ...ready,
      earningsGuidanceCurrent: false,
    },
  });

  assert.equal(result.activeCandidate, false);
  assert.deepEqual(result.failedGates, ["earnings_guidance_freshness"]);
});

test("Monster DNA V2 caps anti-DNA and blocks excessive penalties", () => {
  const result = evaluateMonsterDnaV2({
    pillars: {
      businessDna: 95,
      inflectionExpectations: 92,
      marketConfirmation: 90,
    },
    antiDnaPenalty: 20,
    readiness: ready,
  });

  assert.equal(result.activeCandidate, false);
  assert.ok(result.failedGates.includes("anti_dna_penalty"));
  assert.ok(result.failedGates.includes("adjusted_score"));
});
