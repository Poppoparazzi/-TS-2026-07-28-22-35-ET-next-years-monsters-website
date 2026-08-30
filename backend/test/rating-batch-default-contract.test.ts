// TS: 2026-08-30 14:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchPath = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("rating batch defaults to the full 5,000-company production target", async () => {
  const source = await readFile(ratingBatchPath, "utf8");

  assert.match(
    source,
    /options\.targetCount\s*\?\?\s*5_000/,
    "runRatingBatch must default to the full 5,000-company production target",
  );
  assert.doesNotMatch(
    source,
    /options\.targetCount\s*\?\?\s*500(?!0)/,
    "the retired 500-rating milestone must not return as the batch default",
  );
  assert.match(
    source,
    /Math\.max\(targetCount \* 2, 1_000\)[\s\S]*?5_000/,
    "candidate selection must remain capable of using the full 5,000-company reserve",
  );
});
