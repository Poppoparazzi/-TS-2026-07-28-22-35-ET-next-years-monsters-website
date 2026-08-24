// TS: 2026-08-24 17:04 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rolloutWorker = readFileSync(
  new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
  "utf8",
);

test("Monster Rating rollout gets enough serialized runtime to finish quota-safe paid work", () => {
  assert.match(
    rolloutWorker,
    /timeout-minutes:\s*25/,
    "rating rollout must retain the 25-minute runtime budget needed for preflight plus paced paid attempts",
  );
  assert.match(
    rolloutWorker,
    /group:\s*monster-rating-rollout[\s\S]*?cancel-in-progress:\s*false/,
    "scheduled or backend-triggered rollout runs must not cancel paid work already in progress",
  );
  assert.match(
    rolloutWorker,
    /cron:\s*"8,38 \* \* \* \*"/,
    "25-minute worker runtime must remain inside the 30-minute cadence",
  );
});
