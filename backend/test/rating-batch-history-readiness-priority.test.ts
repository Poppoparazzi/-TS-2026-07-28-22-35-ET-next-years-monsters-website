// TS: 2026-09-08 19:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const BATCH_STORE_PATH = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating rollout prefers candidates with provider-scoped proven market-history readiness before unknown or previously insufficient history", async () => {
  const source = await readFile(BATCH_STORE_PATH, "utf8");

  assert.match(
    source,
    /LEFT JOIN market_history_evidence_latest_by_provider history_readiness\s+ON history_readiness\.company_id = c\.id\s+AND history_readiness\.provider = \$3/s,
  );

  const readinessOrder = source.indexOf("WHEN history_readiness.rating_history_ready = true THEN 0");
  const revenueOrder = source.indexOf("COALESCE(revenue_metric.latest_annual_revenue, -1) DESC");

  assert.ok(readinessOrder >= 0, "persisted provider-scoped history readiness must participate in candidate ordering");
  assert.ok(revenueOrder > readinessOrder, "history readiness should be considered before revenue ordering");
  assert.match(
    source,
    /WHEN history_readiness\.rating_history_ready IS NULL THEN 1\s+ELSE 2/s,
  );
});
