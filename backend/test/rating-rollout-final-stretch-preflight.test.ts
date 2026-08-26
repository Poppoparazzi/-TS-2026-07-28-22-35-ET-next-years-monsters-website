// TS: 2026-08-26 14:02 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const worker = readFileSync(
  new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
  "utf8",
);

test("rating rollout broadens only free preflight in the final two-rating stretch", () => {
  assert.match(worker, /PREFLIGHT_POOL_SIZE:\s*"192"/);
  assert.match(worker, /FINAL_STRETCH_PREFLIGHT_POOL_SIZE:\s*"768"/);
  assert.match(
    worker,
    /finalStretchActive\s*=\s*!firstMilestoneReached\s*&&\s*remainingFirstMilestone\s*>\s*0\s*&&\s*remainingFirstMilestone\s*<=\s*2/,
  );
  assert.match(
    worker,
    /effectivePreflightPoolSize\s*=\s*finalStretchActive[\s\S]*?Math\.max\(preflightPoolSize, finalStretchPreflightPoolSize\)[\s\S]*?:\s*preflightPoolSize/,
  );
});

test("final stretch does not increase paid provider attempts", () => {
  assert.match(
    worker,
    /milestoneAwareRemaining\s*=\s*firstMilestoneReached\s*\?\s*remainingCount\s*:\s*remainingFirstMilestone/,
  );
  assert.match(
    worker,
    /directFallbackBudget\s*=\s*Math\.min\(maxDirectFallbackPerRun, milestoneAwareRemaining\)/,
  );
  assert.match(worker, /MAX_DIRECT_FALLBACK_PER_RUN:\s*"8"/);
  assert.match(worker, /REQUEST_DELAY_MS:\s*"20000"/);
  assert.match(worker, /cancel-in-progress:\s*false/);
});
