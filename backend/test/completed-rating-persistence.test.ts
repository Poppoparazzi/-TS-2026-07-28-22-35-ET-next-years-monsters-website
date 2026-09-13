// TS: 2026-09-13 14:58 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { persistCompletedRatingWithSingleRetry } from "../src/ratings/completed-rating-persistence.js";

test("completed rating persistence succeeds on the first write without retrying", async () => {
  let calls = 0;

  const result = await persistCompletedRatingWithSingleRetry(async () => {
    calls += 1;
  });

  assert.equal(result.persisted, true);
  assert.equal(result.attempts, 1);
  assert.equal(result.error, null);
  assert.equal(calls, 1);
});

test("completed rating persistence retries exactly once using the same write closure", async () => {
  let calls = 0;

  const result = await persistCompletedRatingWithSingleRetry(async () => {
    calls += 1;
    if (calls === 1) throw new Error("transient write failure");
  });

  assert.equal(result.persisted, true);
  assert.equal(result.attempts, 2);
  assert.equal(result.error, null);
  assert.equal(calls, 2);
});

test("completed rating persistence reports pending after two failed writes", async () => {
  let calls = 0;
  const failure = new Error("database unavailable");

  const result = await persistCompletedRatingWithSingleRetry(async () => {
    calls += 1;
    throw failure;
  });

  assert.equal(result.persisted, false);
  assert.equal(result.attempts, 2);
  assert.equal(result.error, failure);
  assert.equal(calls, 2);
});
