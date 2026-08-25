// TS: 2026-08-25 18:21 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchPath = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("rating batch keeps bounded retry logic for transient market-provider limits", async () => {
  const source = await readFile(ratingBatchPath, "utf8");

  assert.match(
    source,
    /let providerLimitRetries = 0;/,
    "paced market history must track provider-limit retries",
  );
  assert.match(
    source,
    /providerLimitReached\(message\) \|\| providerLimitRetries >= marketLimitMaxRetries/,
    "non-limit failures and exhausted retries must leave the retry loop",
  );
  assert.match(
    source,
    /providerLimitRetries \+= 1;[\s\S]*?await sleep\(marketLimitRetryMs\);/,
    "a transient provider limit must wait before the bounded retry",
  );
  assert.match(
    source,
    /benchmarkHistory = await getPacedHistory\("SPY", 300\);/,
    "benchmark history must still use the paced retrying market-history path",
  );
  assert.match(
    source,
    /history = await getPacedHistory\(candidate\.ticker, 300\);/,
    "company history must still use the paced retrying market-history path",
  );
});
