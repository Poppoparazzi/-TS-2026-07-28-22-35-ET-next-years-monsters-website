// TS: 2026-09-06 13:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("quota-safe candidate ordering prefers fresh reusable market evidence before weaker reserve candidates", async () => {
  const source = await readFile(batchStoreUrl, "utf8");

  const orderByStart = source.indexOf("ORDER BY CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE}");
  const orderByEnd = source.indexOf("LIMIT $1", orderByStart);
  assert.notEqual(orderByStart, -1, "candidate query must retain the protected-company ordering anchor");
  assert.notEqual(orderByEnd, -1, "candidate query must retain its bounded candidate limit");

  const ordering = source.slice(orderByStart, orderByEnd);
  const freshHistory = ordering.indexOf("history_readiness.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
  const freshLatestBar = ordering.indexOf("history_readiness.latest_bar_date >= CURRENT_DATE - INTERVAL '7 days'");
  const readyHistory = ordering.indexOf("history_readiness.rating_history_ready = true");
  const verifiedLiquidity = ordering.indexOf("history_readiness.twenty_session_average_dollar_volume >= 1000000");
  const storedLiquidityPriority = ordering.indexOf("WHEN stored_liquidity.dollar_volume >= 1000000 THEN 0");
  const unknownLiquidityPriority = ordering.indexOf("WHEN stored_liquidity.dollar_volume IS NULL THEN 1", storedLiquidityPriority);
  const weakLiquidityPriority = ordering.indexOf("ELSE 2", unknownLiquidityPriority);
  const revenueDepth = ordering.indexOf("CASE WHEN COALESCE(revenue_depth.annual_revenue_period_count, 0) >= 2 THEN 0 ELSE 1 END", weakLiquidityPriority);

  assert.ok(freshHistory >= 0, "candidate ordering must explicitly require recently retrieved stored market evidence");
  assert.ok(freshLatestBar > freshHistory, "recent retrieval alone must not count as fresh when the provider's latest bar is stale");
  assert.ok(readyHistory > freshLatestBar, "fresh provider-bar evidence must be evaluated before stored rating-history readiness");
  assert.ok(verifiedLiquidity > readyHistory, "verified stored liquidity must remain ahead of weaker evidence-depth tie-breakers");
  assert.ok(storedLiquidityPriority > verifiedLiquidity, "fresh quote liquidity must remain a fallback behind verified market-history liquidity");
  assert.ok(unknownLiquidityPriority > storedLiquidityPriority, "unknown quote liquidity must rank behind a verified >=$1M fresh quote");
  assert.ok(weakLiquidityPriority > unknownLiquidityPriority, "known fresh sub-$1M quote liquidity must rank behind unknown liquidity so scarce paid history calls favor unresolved candidates");
  assert.ok(revenueDepth > weakLiquidityPriority, "the granular annual-revenue-depth tie-breaker must remain ahead of generic SEC fact/filing counts");

  assert.match(
    ordering,
    /WHEN history_readiness\.retrieved_at IS NULL THEN 1\s+ELSE 2/s,
    "no-history candidates must remain ahead of candidates whose stored history is stale enough to require refresh",
  );
  assert.match(
    ordering,
    /history_readiness\.latest_bar_date IS NULL\s+OR history_readiness\.latest_bar_date < CURRENT_DATE - INTERVAL '7 days'/s,
    "stale or missing latest-bar dates must not receive verified-liquidity priority",
  );
  assert.match(
    ordering,
    /WHEN stored_liquidity\.dollar_volume >= 1000000 THEN 0\s+WHEN stored_liquidity\.dollar_volume IS NULL THEN 1\s+ELSE 2/s,
    "stored quote tie-break must be strong verified liquidity first, unknown second, weak fresh quote last",
  );
});
