// TS: 2026-09-04 10:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const BATCH_STORE_PATH = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("Monster Rating batch prioritizes persisted readiness, reusable history liquidity, fresh stored liquidity, and SEC evidence before verified revenue", async () => {
  const source = await readFile(BATCH_STORE_PATH, "utf8");

  const protectedOrder = source.indexOf("CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END");
  const pilotOrder = source.indexOf("c.is_pilot DESC");
  const historyReadyOrder = source.indexOf("WHEN history_readiness.rating_history_ready = true THEN 0");
  const historyLiquidityPresentOrder = source.indexOf("CASE WHEN history_readiness.twenty_session_average_dollar_volume IS NOT NULL");
  const historyLiquidityValueOrder = source.indexOf("THEN history_readiness.twenty_session_average_dollar_volume END");
  const storedLiquidityPresentOrder = source.indexOf("CASE WHEN stored_liquidity.dollar_volume IS NOT NULL THEN 0 ELSE 1 END");
  const storedLiquidityValueOrder = source.indexOf("COALESCE(stored_liquidity.dollar_volume, -1) DESC");
  const factOrder = source.indexOf("COALESCE(fact_depth.fact_count, 0) DESC");
  const filingOrder = source.indexOf("COALESCE(filing_depth.filing_count, 0) DESC");
  const revenueOrder = source.indexOf("COALESCE(revenue_metric.latest_annual_revenue, -1) DESC");

  assert.ok(protectedOrder >= 0, "protected-stock priority must remain first");
  assert.ok(pilotOrder > protectedOrder, "pilot priority must remain ahead of ordinary candidates");
  assert.ok(historyReadyOrder > pilotOrder, "persisted provider-backed history readiness must rank before ordinary evidence signals");
  assert.ok(historyLiquidityPresentOrder > historyReadyOrder, "persisted 20-session liquidity availability must rank after history readiness");
  assert.ok(historyLiquidityValueOrder > historyLiquidityPresentOrder, "stronger persisted 20-session liquidity must rank ahead of point-in-time quote liquidity");
  assert.ok(storedLiquidityPresentOrder > historyLiquidityValueOrder, "fresh stored quote liquidity must remain a secondary free liquidity signal");
  assert.ok(storedLiquidityValueOrder > storedLiquidityPresentOrder, "stronger stored quote dollar-volume evidence must rank ahead of SEC-depth tie breakers");
  assert.ok(factOrder > storedLiquidityValueOrder, "SEC fact depth must rank after stored-liquidity evidence");
  assert.ok(filingOrder > factOrder, "SEC filing depth must rank after fact depth");
  assert.ok(revenueOrder > filingOrder, "verified annual revenue must remain below evidence-depth signals");

  assert.match(source, /LEFT JOIN market_history_evidence_latest history_readiness/);
  assert.match(source, /history_readiness\.twenty_session_average_dollar_volume IS NOT NULL/);
  assert.match(source, /history_readiness\.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'/);
  assert.match(source, /SELECT \(qs\.price \* qs\.volume\)::numeric AS dollar_volume/);
  assert.match(source, /qs\.provider_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'/);
  assert.match(source, /qs\.provider_timestamp <= CURRENT_TIMESTAMP \+ INTERVAL '5 minutes'/);
  assert.match(source, /LEFT JOIN LATERAL \(\s*SELECT count\(\*\) AS fact_count/s);
  assert.match(source, /LEFT JOIN LATERAL \(\s*SELECT count\(\*\) AS filing_count/s);
});
