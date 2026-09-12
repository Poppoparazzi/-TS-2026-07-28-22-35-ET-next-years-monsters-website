// TS: 2026-09-12 02:00 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchSourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("stale cached benchmark falls through to the shared paced SPY refresh", async () => {
  const source = await readFile(ratingBatchSourceUrl, "utf8");

  assert.doesNotMatch(
    source,
    /Persisted benchmark preflight blocked paid company history/,
    "invalid cached SPY must not stop the whole rating batch",
  );
  assert.match(
    source,
    /if \(!cachedBenchmarkProblem\) benchmarkHistory = cachedBenchmarkHistory;/,
    "only a valid provider-matching cached benchmark should be reused",
  );
  assert.match(
    source,
    /if \(!benchmarkHistory\)[\s\S]*?getPacedHistory\("SPY", 300\)/,
    "an invalid or stale cached benchmark must be allowed to fall through to one shared paced refresh",
  );
});
