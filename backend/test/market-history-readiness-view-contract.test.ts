// TS: 2026-08-28 10:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/1005_market_history_readiness_view.sql",
  import.meta.url,
);

test("market history readiness view uses only persisted provider-backed evidence", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /CREATE OR REPLACE VIEW market_history_evidence_latest/i);
  assert.match(sql, /FROM market_history_evidence mhe/i);
  assert.match(sql, /mhe\.usable_bar_count >= 253/i);
  assert.match(sql, /mhe\.provider/i);
  assert.match(sql, /mhe\.retrieved_at/i);
  assert.match(sql, /mhe\.feed_disclosure/i);
  assert.doesNotMatch(sql, /quote_snapshots/i);
  assert.doesNotMatch(sql, /company_pipeline_status/i);
});
