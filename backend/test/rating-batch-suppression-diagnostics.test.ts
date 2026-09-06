// TS: 2026-09-06 07:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ratingBatchSourceUrl = new URL("../src/jobs/rating-batch.ts", import.meta.url);

test("persisted market-history suppression diagnostics stay aligned with machine reasons", async () => {
  const source = await readFile(ratingBatchSourceUrl, "utf8");

  assert.match(source, /suppressionReason === "insufficient_liquidity"/);
  assert.match(source, /average daily dollar volume below the \$1 million tradability floor/);

  assert.match(source, /suppressionReason === "stale_market_data"/);
  assert.match(source, /market history is stale and cannot be reused for a current rating/);

  assert.match(source, /suppressionReason === "insufficient_market_history"/);
  assert.match(source, /usable daily bars; at least 253 are required/);

  assert.match(
    source,
    /reason: reusableHistorySuppressionReason\(suppression\.suppressionReason, suppression\.usableBarCount\)/,
  );
});
