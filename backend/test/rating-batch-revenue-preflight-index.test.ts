// TS: 2026-09-06 21:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../database/migrations/1016_rating_revenue_preflight_index.sql", import.meta.url);
const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating revenue preflight uses an index aligned with annual SEC evidence gates", async () => {
  const [migration, batchStore] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(batchStorePath, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS company_facts_rating_revenue_preflight_idx[\s\S]*ON company_facts[\s\S]*company_id,[\s\S]*fiscal_year DESC,[\s\S]*period_end DESC,[\s\S]*filed_date DESC[\s\S]*INCLUDE \(value_numeric, retrieved_at\)[\s\S]*taxonomy = 'us-gaap'[\s\S]*fiscal_period = 'FY'/,
    "annual SEC revenue evidence should have a narrow company/year/date index for candidate preflight",
  );

  assert.match(
    batchStore,
    /revenue_metric[\s\S]*taxonomy = 'us-gaap'[\s\S]*fiscal_period = 'FY'[\s\S]*revenue_depth[\s\S]*count\(DISTINCT cf\.fiscal_year\)/,
    "the index must remain aligned with the revenue metric and annual-depth checks used to prioritize rating candidates",
  );

  assert.match(
    batchStore,
    /EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL[\s\S]*insufficient_financial_history[\s\S]*company_facts newer_revenue_fact[\s\S]*newer_revenue_fact\.retrieved_at > drr\.started_at/,
    "the index must continue to support evidence-change reopening for recent insufficient-financial-history suppression",
  );
});
