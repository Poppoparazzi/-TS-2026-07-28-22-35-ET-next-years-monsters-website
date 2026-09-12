// TS: 2026-09-12 02:00 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchSourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("stale cached benchmark refreshes while structurally invalid cached SPY remains quota-blocking", async () => {
  const source = await readFile(ratingBatchSourceUrl, "utf8");

  assert.match(
    source,
    /cachedBenchmarkProblem\.startsWith\("Benchmark market history is stale;"\)/,
    "stale-but-otherwise-usable SPY must be distinguished from structural benchmark failure",
  );
  assert.match(
    source,
    /Persisted benchmark preflight blocked paid company history/,
    "structurally invalid cached SPY must still stop before paid company-history work",
  );
  assert.match(
    source,
    /if \(!benchmarkHistory\)[\s\S]*?getPacedHistory\("SPY", 300\)/,
    "stale cached SPY must be allowed to fall through to the existing shared paced refresh",
  );
});
