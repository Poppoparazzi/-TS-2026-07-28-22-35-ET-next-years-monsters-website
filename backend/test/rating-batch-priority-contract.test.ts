// TS: 2026-09-04 11:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const BATCH_STORE_PATH = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("Monster Rating batch prioritizes persisted readiness, qualifying reusable liquidity, fresh stored liquidity, and SEC evidence before verified revenue", async () => {
  const source = await readFile(BATCH_STORE_PATH, "utf8");

  const protectedOrder = source.indexOf("CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END");
  const pilotOrder = source.indexOf("c.is_pilot DESC");
  const historyReadyOrder = source.indexOf("WHEN history_readiness.rating_history_ready = true THEN 0");
  const historyLiquidityFloorOrder = source.indexOf("history_readiness.twenty_session_average_dollar_volume >= 1000000 THEN 0");
  const historyLiquidityUnknownOrder = source.indexOf("history_readiness.twenty_session_average_dollar_volume IS NULL");
  const historyLiquidityValueOrder = source.indexOf("THEN history_readiness.twenty_session_average_dollar_volume END");
  const storedLiquidityPresentOrder = source.indexOf("CASE WHEN stored_liquidity.dollar_volume IS NOT NULL THEN 0 ELSE 1 END");
  const storedLiquidityValueOrder = source.indexOf("COALESCE(stored_liquidity.dollar_volume, -1) DESC");
  const factOrder = source.indexOf("COALESCE(fact_depth.fact_count, 0) DESC");
  const filingOrder = source.indexOf("COALESCE(filing_depth.filing_count, 0) DESC");
  const revenueOrder = source.indexOf("COALESCE(revenue_metric.latest_annual_revenue, -1) DESC");

  assert.ok(protectedOrder >= 0, "protected-stock priority must remain first");
  assert.ok(pilotOrder > protectedOrder, "pilot priority must remain ahead of ordinary candidates");
  assert.ok(historyReadyOrder > pilotOrder, "persisted provider-backed history readiness must rank before ordinary evidence signals");
  assert.ok(historyLiquidityFloorOrder > historyReadyOrder, "recent persisted liquidity at or above the engine floor must rank after history readiness");
  assert.ok(historyLiquidityUnknownOrder > historyLiquidityFloorOrder, "unknown or stale persisted liquidity must rank between qualifying and known below-floor evidence");
  assert.ok(historyLiquidityValueOrder > historyLiquidityUnknownOrder, "stronger qualifying persisted liquidity must break ties ahead of point-in-time quote liquidity");
  assert.ok(storedLiquidityPresentOrder > historyLiquidityValueOrder, "fresh stored quote liquidity must remain a secondary free liquidity signal");
  assert.ok(storedLiquidityValueOrder > storedLiquidityPresentOrder, "stronger stored quote dollar-volume evidence must rank ahead of SEC-depth tie breakers");
  assert.ok(factOrder > storedLiquidityValueOrder, "SEC fact depth must rank after stored-liquidity evidence");
  assert.ok(filingOrder > factOrder, "SEC filing depth must rank after fact depth");
  assert.ok(revenueOrder > filingOrder, "verified annual revenue must remain below evidence-depth signals");

  assert.match(source, /LEFT JOIN market_history_evidence_latest history_readiness/);
  assert.match(source, /history_readiness\.twenty_session_average_dollar_volume >= 1000000 THEN 0/);
  assert.match(source, /history_readiness\.twenty_session_average_dollar_volume IS NULL\s+OR history_readiness\.retrieved_at < CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1/);
  assert.match(source, /ELSE 2\s+END,/);
  assert.match(source, /history_readiness\.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'/);
  assert.match(source, /SELECT \(qs\.price \* qs\.volume\)::numeric AS dollar_volume/);
  assert.match(source, /qs\.provider_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'/);
  assert.match(source, /qs\.provider_timestamp <= CURRENT_TIMESTAMP \+ INTERVAL '5 minutes'/);
  assert.match(source, /LEFT JOIN LATERAL \(\s*SELECT count\(\*\) AS fact_count/s);
  assert.match(source, /LEFT JOIN LATERAL \(\s*SELECT count\(\*\) AS filing_count/s);
});
