// TS: 2026-09-06 22:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../database/migrations/1017_rating_stored_liquidity_preflight_index.sql", import.meta.url);
const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating stored-liquidity preflight has an index aligned with the quota-safe latest-quote lookup", async () => {
  const [migration, batchStore] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(batchStoreUrl, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS quote_snapshots_rating_liquidity_preflight_idx[\s\S]*ON quote_snapshots[\s\S]*company_id,[\s\S]*provider_timestamp DESC,[\s\S]*retrieved_at DESC[\s\S]*INCLUDE \(price, volume\)[\s\S]*WHERE price > 0[\s\S]*AND volume > 0/,
    "stored quote liquidity evidence should have a narrow covering company/time index",
  );

  assert.match(
    batchStore,
    /FROM quote_snapshots qs[\s\S]*?qs\.company_id = c\.id[\s\S]*?qs\.price > 0[\s\S]*?qs\.volume > 0[\s\S]*?qs\.provider_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'[\s\S]*?qs\.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'[\s\S]*?ORDER BY qs\.provider_timestamp DESC, qs\.retrieved_at DESC[\s\S]*?LIMIT 1/,
    "candidate selection must continue using fresh stored quote evidence before paid market-history calls",
  );

  assert.match(
    batchStore,
    /WHEN stored_liquidity\.dollar_volume >= 1000000 THEN 0[\s\S]*WHEN stored_liquidity\.dollar_volume IS NULL THEN 1[\s\S]*ELSE 2/,
    "quota-safe ordering must keep strong stored liquidity ahead of unknown and weak stored liquidity",
  );
});
