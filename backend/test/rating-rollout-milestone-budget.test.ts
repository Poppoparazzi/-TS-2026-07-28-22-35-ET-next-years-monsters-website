// TS: 2026-08-26 08:01 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRolloutWorker(): string {
  return readFileSync(
    new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
    "utf8",
  );
}

function milestoneAwareBudget(count: number): number {
  const target = 5000;
  const firstMilestone = 500;
  const maxDirectFallbackPerRun = 8;
  const remainingCount = Math.max(target - count, 0);
  const remainingFirstMilestone = Math.max(firstMilestone - count, 0);
  const firstMilestoneReached = count >= firstMilestone;
  const milestoneAwareRemaining = firstMilestoneReached ? remainingCount : remainingFirstMilestone;
  return Math.min(maxDirectFallbackPerRun, milestoneAwareRemaining);
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

test("paid fallback budget crosses 500 without overshoot or accidental shutdown", () => {
  assert.equal(milestoneAwareBudget(495), 5, "five ratings short of 500 must permit only five paid attempts");
  assert.equal(milestoneAwareBudget(499), 1, "one rating short of 500 must permit only one paid attempt");
  assert.equal(milestoneAwareBudget(500), 8, "at 500 the worker must resume the bounded broad-coverage budget");
  assert.equal(milestoneAwareBudget(501), 8, "after 500 the worker must continue broad coverage safely");
  assert.equal(milestoneAwareBudget(4999), 1, "one rating short of the long-range target must permit only one paid attempt");
  assert.equal(milestoneAwareBudget(5000), 0, "the worker must stop paid attempts at the long-range target");
});
