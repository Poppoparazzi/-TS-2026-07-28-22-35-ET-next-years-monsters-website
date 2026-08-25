// TS: 2026-08-25 03:05 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRolloutWorker(): string {
  return readFileSync(
    new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
    "utf8",
  );
}

test("paid direct fallback respects the remaining first-500 milestone before broad continuation", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(rolloutWorker, /FIRST_MILESTONE_COUNT:\s*"500"/);
  assert.match(rolloutWorker, /TARGET_COUNT:\s*"5000"/);
  assert.match(
    rolloutWorker,
    /remainingFirstMilestone\s*=\s*Math\.max\(firstMilestone - count, 0\)/,
    "worker must calculate the exact distance remaining to the first 500 ratings",
  );
  assert.match(
    rolloutWorker,
    /milestoneAwareRemaining\s*=\s*firstMilestoneReached\s*\?\s*remainingCount\s*:\s*remainingFirstMilestone/,
    "before 500, the paid budget must use the milestone shortfall; after 500, it may continue toward the broad target",
  );
  assert.match(
    rolloutWorker,
    /directFallbackBudget\s*=\s*Math\.min\(maxDirectFallbackPerRun, milestoneAwareRemaining\)/,
    "paid fallback attempts must not exceed the remaining first-milestone distance",
  );
});
