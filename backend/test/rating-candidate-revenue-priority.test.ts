// TS: 2026-09-13 00:00 UTC

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const batchStoreSource = readFileSync(new URL("../src/ratings/batch-store.ts", import.meta.url), "utf8");

test("rating candidate revenue priority uses the same verified annual-period evidence as revenue depth", () => {
  assert.match(
    batchStoreSource,
    /SELECT cf\.value_numeric AS latest_annual_revenue[\s\S]*?cf\.fiscal_period = 'FY'[\s\S]*?cf\.fiscal_year IS NOT NULL[\s\S]*?cf\.form_type IN \('10-K','10-K\/A','20-F','20-F\/A','40-F','40-F\/A'\)/,
    "latest annual revenue priority must not be sourced from an annual-looking fact with no fiscal year",
  );
  assert.match(
    batchStoreSource,
    /SELECT count\(DISTINCT cf\.fiscal_year\) AS annual_revenue_period_count[\s\S]*?cf\.fiscal_year IS NOT NULL AND cf\.fiscal_period = 'FY'/,
    "revenue depth must keep requiring explicit fiscal-year annual facts",
  );
});
