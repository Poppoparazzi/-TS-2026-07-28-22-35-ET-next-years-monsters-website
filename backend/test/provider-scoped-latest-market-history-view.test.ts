// TS: 2026-09-08 18:10 ET

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const migrationPath = path.resolve(
  process.cwd(),
  "database/migrations/1035_provider_scoped_latest_market_history.sql",
);

const migrationSql = fs.readFileSync(migrationPath, "utf8");

test("provider-scoped latest market-history view keeps evidence isolated by provider", () => {
  assert.match(migrationSql, /CREATE OR REPLACE VIEW market_history_evidence_latest_by_provider/i);
  assert.match(migrationSql, /DISTINCT ON \(mhe\.company_id, mhe\.provider\)/i);
  assert.match(migrationSql, /mhe\.provider/i);
  assert.match(migrationSql, /ORDER BY\s+mhe\.company_id,\s+mhe\.provider,\s+mhe\.retrieved_at DESC/i);
  assert.doesNotMatch(migrationSql, /WHERE\s+mhe\.provider\s*=\s*'twelve-data'/i);
});
