// TS: 2026-09-08 21:09 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../database/migrations/1036_market_history_suppression_evidence_consistency.sql", import.meta.url),
  "utf8",
);

test("durable market-history suppression is backed by matching evidence thresholds", () => {
  assert.match(migration, /market_history_evidence_suppression_evidence_consistency/);
  assert.match(migration, /suppression_reason = 'insufficient_market_history'[\s\S]*usable_bar_count < 253/);
  assert.match(migration, /suppression_reason = 'insufficient_liquidity'[\s\S]*usable_bar_count >= 253/);
  assert.match(migration, /twenty_session_average_dollar_volume IS NOT NULL/);
  assert.match(migration, /twenty_session_average_dollar_volume < 1000000/);
  assert.match(migration, /suppression_reason = 'stale_market_data'[\s\S]*usable_bar_count >= 253[\s\S]*latest_bar_date IS NOT NULL/);
  assert.match(migration, /NOT VALID/);
});
