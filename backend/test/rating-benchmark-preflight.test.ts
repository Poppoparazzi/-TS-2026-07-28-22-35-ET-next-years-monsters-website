// TS: 2026-08-30 17:05 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("rating batch validates shared benchmark history before paid company history", () => {
  const source = readFileSync(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");

  const benchmarkFetch = source.indexOf('benchmarkHistory = await getPacedHistory("SPY", 300)');
  const benchmarkValidation = source.indexOf("validateBenchmarkHistory(benchmarkHistory)");
  const companyHistoryFetch = source.indexOf("history = await getPacedHistory(candidate.ticker, 300)");

  assert.ok(benchmarkFetch >= 0, "rating batch must fetch the shared SPY benchmark");
  assert.ok(benchmarkValidation > benchmarkFetch, "benchmark history must be validated after it is fetched");
  assert.ok(
    companyHistoryFetch > benchmarkValidation,
    "benchmark history must pass its 253-session/freshness gate before any paid company-history request",
  );
  assert.match(source, /usableBars\.length < 253/);
  assert.match(
    source,
    /\(calculatedTime - latestTime\) \/ \(24 \* 60 \* 60 \* 1_000\) > 7/,
    "benchmark freshness must remain capped at seven days even when the implementation computes age inline",
  );
});
