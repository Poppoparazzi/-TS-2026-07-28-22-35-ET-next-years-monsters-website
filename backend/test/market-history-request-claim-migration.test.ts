// TS: 2026-09-05 17:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../database/migrations/1012_market_history_request_claims.sql", import.meta.url);

test("market-history request claims are unique per company provider and rating version", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /PRIMARY KEY \(company_id, provider, rating_version\)/);
  assert.match(sql, /ON CONFLICT \(company_id, provider, rating_version\)/);
});

test("market-history request claims can only be taken over after expiry", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /WHERE market_history_request_claims\.expires_at <= CURRENT_TIMESTAMP/);
  assert.match(sql, /GREATEST\(60, LEAST\(COALESCE\(p_lease_seconds, 900\), 3600\)\)/);
});

test("market-history request claims are released only by their owning run", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE OR REPLACE FUNCTION release_market_history_request_claim/);
  assert.match(sql, /AND run_id IS NOT DISTINCT FROM p_run_id/);
});
