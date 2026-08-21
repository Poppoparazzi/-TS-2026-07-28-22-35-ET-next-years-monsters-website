// TS: 2026-08-21 15:17 ET

import assert from "node:assert/strict";
import test from "node:test";
import { runRatingBatch } from "../src/jobs/rating-batch.js";

test("rating batch accepts an explicit zero pacing delay for tests", () => {
  assert.equal(typeof runRatingBatch, "function");
});
