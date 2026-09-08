// TS: 2026-09-08 16:10 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../database/migrations/1033_market_history_machine_reason_consistency.sql", import.meta.url),
  "utf8",
);

test("market-history machine reasons remain internally consistent for new writes", () => {
  assert.match(migration, /market_history_evidence_machine_reason_consistency/);
  assert.match(migration, /rating_eligibility_code = 'eligible'[\s\S]*suppression_reason IS NULL/);
  assert.match(migration, /'insufficient_market_history'/);
  assert.match(migration, /'insufficient_liquidity'/);
  assert.match(migration, /'stale_market_data'/);
  assert.match(migration, /suppression_reason = rating_eligibility_code/);
  assert.match(migration, /NOT VALID/);
});
