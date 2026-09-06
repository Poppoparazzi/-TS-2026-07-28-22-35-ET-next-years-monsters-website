// TS: 2026-09-06 03:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("paid-history queue prioritizes candidates with both verified liquidity and multi-year revenue evidence", async () => {
  const source = await readFile(batchStoreUrl, "utf8");
  const orderByStart = source.indexOf("ORDER BY CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE}");
  const orderByEnd = source.indexOf("LIMIT $1", orderByStart);
  assert.notEqual(orderByStart, -1);
  assert.notEqual(orderByEnd, -1);

  const ordering = source.slice(orderByStart, orderByEnd);
  const combinedBucket = ordering.indexOf("history_readiness.rating_history_ready = true");
  const historyLiquidity = ordering.indexOf("history_readiness.twenty_session_average_dollar_volume >= 1000000", combinedBucket);
  const multiYearRevenue = ordering.indexOf("COALESCE(revenue_depth.annual_revenue_period_count, 0) >= 2 THEN 0", historyLiquidity);
  const quoteFallback = ordering.indexOf("stored_liquidity.dollar_volume >= 1000000", multiYearRevenue);
  const weakerHistoryOrdering = ordering.indexOf("WHEN history_readiness.retrieved_at IS NULL THEN 1", quoteFallback);

  assert.ok(combinedBucket >= 0, "combined priority bucket must require rating-ready stored history");
  assert.ok(historyLiquidity > combinedBucket, "combined priority bucket must require verified 20-session liquidity");
  assert.ok(multiYearRevenue > historyLiquidity, "combined priority bucket must also require at least two annual revenue periods");
  assert.ok(quoteFallback > multiYearRevenue, "fresh quote liquidity plus revenue depth must remain a fallback behind provider-backed history liquidity");
  assert.ok(weakerHistoryOrdering > quoteFallback, "combined evidence buckets must be evaluated before weaker individual tie-breakers");
});
