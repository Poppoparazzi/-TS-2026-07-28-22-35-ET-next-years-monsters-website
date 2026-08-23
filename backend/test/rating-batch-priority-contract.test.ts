// TS: 2026-08-23 06:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const BATCH_STORE_PATH = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("Monster Rating batch prioritizes evidence depth before company-size proxy", async () => {
  const source = await readFile(BATCH_STORE_PATH, "utf8");

  const protectedOrder = source.indexOf("CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END");
  const pilotOrder = source.indexOf("c.is_pilot DESC");
  const factOrder = source.indexOf("COALESCE(fact_depth.fact_count, 0) DESC");
  const filingOrder = source.indexOf("COALESCE(filing_depth.filing_count, 0) DESC");
  const sizeOrder = source.indexOf("COALESCE(size_metric.priority_metric, 0) DESC");

  assert.ok(protectedOrder >= 0, "protected-stock priority must remain first");
  assert.ok(pilotOrder > protectedOrder, "pilot priority must remain ahead of ordinary candidates");
  assert.ok(factOrder > pilotOrder, "SEC fact depth must rank after protected/pilot priority");
  assert.ok(filingOrder > factOrder, "SEC filing depth must rank after fact depth");
  assert.ok(sizeOrder > filingOrder, "company-size proxy must remain below evidence-depth signals");

  assert.match(source, /LEFT JOIN LATERAL \(\s*SELECT count\(\*\) AS fact_count/s);
  assert.match(source, /LEFT JOIN LATERAL \(\s*SELECT count\(\*\) AS filing_count/s);
});
