// TS: 2026-09-12 09:01 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("paid refresh ordering prefers stale previously-ready history over unknown history", async () => {
  const source = await readFile(batchStoreUrl, "utf8");
  const orderByStart = source.indexOf("ORDER BY CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END");
  assert.ok(orderByStart >= 0, "protected-company priority must remain the first ordering key");

  const orderingSource = source.slice(orderByStart);
  const freshHistory = orderingSource.indexOf(
    "WHEN history_readiness.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'\n              AND history_readiness.latest_bar_date >= CURRENT_DATE - INTERVAL '7 days'\n              AND history_readiness.latest_bar_date <= CURRENT_DATE THEN 0",
  );
  const staleReady = orderingSource.indexOf("history_readiness.retrieved_at IS NOT NULL\n              AND history_readiness.rating_history_ready = true THEN 1");
  const unknownHistory = orderingSource.indexOf("history_readiness.retrieved_at IS NULL THEN 2");
  const staleNotReady = orderingSource.indexOf("ELSE 3", unknownHistory);

  assert.ok(freshHistory >= 0, "fresh provider history must remain the first market-history ordering bucket");
  assert.ok(staleReady > freshHistory, "stale previously-ready history must have an explicit paid-refresh priority bucket");
  assert.ok(unknownHistory > staleReady, "unknown history must follow stale previously-ready evidence");
  assert.ok(staleNotReady > unknownHistory, "stale previously-not-ready evidence must remain behind unknown history");

  assert.match(
    orderingSource,
    /stored_liquidity\.dollar_volume >= 1000000[\s\S]*annual_revenue_period_count, 0\) >= 2 THEN 1/,
    "fresh stored liquidity plus at least two annual revenue periods must remain ahead of weaker evidence",
  );
});
