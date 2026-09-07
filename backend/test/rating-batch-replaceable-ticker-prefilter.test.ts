// TS: 2026-09-07 01:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);
const migrationPath = new URL("../database/migrations/1018_rating_replaceable_ticker_gin.sql", import.meta.url);

test("recent replaceable suppression prefilters rating metadata by ticker before element-level checks", async () => {
  const source = await readFile(batchStorePath, "utf8");
  const recentFailureSql = source.match(/export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `([\s\S]*?)`;/)?.[1];
  assert.ok(recentFailureSql, "recent replaceable failure SQL must remain defined");

  const containment = "drr.metadata -> 'replaceable' @> jsonb_build_array(jsonb_build_object('ticker', c.ticker))";
  const containmentIndex = recentFailureSql.indexOf(containment);
  const elementTickerIndex = recentFailureSql.indexOf("prior_failure ->> 'ticker' = c.ticker");

  assert.ok(containmentIndex >= 0, "ticker-aware JSON containment prefilter must be present");
  assert.ok(elementTickerIndex > containmentIndex, "ticker containment must prefilter runs before element-level ticker checks");
  assert.match(recentFailureSql, /drr\.refresh_type = 'ratings'/);
  assert.match(recentFailureSql, /INTERVAL '30 days'/);

  for (const reason of [
    "unresolved_sec_identity",
    "insufficient_financial_history",
    "unsupported_security_type",
  ]) {
    assert.match(recentFailureSql, new RegExp(reason));
  }

  assert.match(
    recentFailureSql,
    /unresolved_sec_identity'[\s\S]*c\.sec_cik IS NOT NULL[\s\S]*cps\.sec_status = 'complete'/,
    "repaired SEC identity must still reopen a candidate",
  );
  assert.match(
    recentFailureSql,
    /insufficient_financial_history'[\s\S]*newer_revenue_fact\.retrieved_at > drr\.started_at[\s\S]*count\(DISTINCT current_revenue_fact\.fiscal_year\)[\s\S]*>= 2/,
    "newer qualifying annual revenue evidence must still reopen a candidate",
  );
});

test("rating replaceable ticker containment is backed by a compatible partial GIN index", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /USING gin \(\(metadata -> 'replaceable'\) jsonb_path_ops\)/);
  assert.match(migration, /WHERE refresh_type = 'ratings'/);
});
