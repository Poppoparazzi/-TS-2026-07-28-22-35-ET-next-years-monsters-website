// TS: 2026-09-13 01:00 UTC

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const batchStoreSource = readFileSync(new URL("../src/ratings/batch-store.ts", import.meta.url), "utf8");

test("stored quote liquidity remains eligible for candidate priority across weekends and market holidays", () => {
  assert.match(
    batchStoreSource,
    /qs\.provider_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'[\s\S]*?qs\.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'/,
    "candidate priority should retain recent stored liquidity evidence across ordinary market closures",
  );
  assert.doesNotMatch(
    batchStoreSource,
    /qs\.provider_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'[\s\S]*?qs\.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'/,
    "candidate priority must not discard Friday liquidity evidence merely because the market is closed for a weekend",
  );
  assert.match(
    batchStoreSource,
    /qs\.provider_timestamp <= CURRENT_TIMESTAMP \+ INTERVAL '5 minutes'[\s\S]*?qs\.retrieved_at <= CURRENT_TIMESTAMP \+ INTERVAL '5 minutes'[\s\S]*?qs\.provider_timestamp <= qs\.retrieved_at \+ INTERVAL '5 minutes'/,
    "future-timestamp guards must remain intact while widening the market-closure freshness window",
  );
});
