// TS: 2026-08-26 16:08 ET

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

function effectivePreflightPool(count: number): number {
  const firstMilestone = 500;
  const preflightPoolSize = 192;
  const finalStretchPreflightPoolSize = 768;
  const remainingFirstMilestone = Math.max(firstMilestone - count, 0);
  const firstMilestoneReached = count >= firstMilestone;
  const finalStretchActive = !firstMilestoneReached && remainingFirstMilestone > 0 && remainingFirstMilestone <= 2;
  return finalStretchActive
    ? Math.max(preflightPoolSize, finalStretchPreflightPoolSize)
    : preflightPoolSize;
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

test("final-stretch preflight expands only before 500 and returns to normal after the milestone", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(rolloutWorker, /PREFLIGHT_POOL_SIZE:\s*"192"/);
  assert.match(rolloutWorker, /FINAL_STRETCH_PREFLIGHT_POOL_SIZE:\s*"768"/);
  assert.equal(effectivePreflightPool(497), 192, "normal preflight must remain in effect more than two ratings from 500");
  assert.equal(effectivePreflightPool(498), 768, "two ratings from 500 should widen only the free preflight pool");
  assert.equal(effectivePreflightPool(499), 768, "one rating from 500 should keep the widened free preflight pool");
  assert.equal(effectivePreflightPool(500), 192, "at 500 the worker must return to the normal post-milestone preflight pool");
  assert.equal(effectivePreflightPool(502), 192, "post-500 expansion must stay on the normal bounded preflight policy");
});
