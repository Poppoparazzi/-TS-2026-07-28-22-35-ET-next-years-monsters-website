// TS: 2026-08-28 08:08 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  testDirectory,
  "../database/migrations/1004_market_history_evidence.sql",
);

test("market history evidence migration preserves provider-backed preflight fields", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS market_history_evidence/i);
  assert.match(sql, /company_id bigint NOT NULL REFERENCES companies\(id\) ON DELETE CASCADE/i);
  assert.match(sql, /provider text NOT NULL/i);
  assert.match(sql, /usable_bar_count integer NOT NULL CHECK \(usable_bar_count >= 0\)/i);
  assert.match(sql, /latest_bar_date date/i);
  assert.match(sql, /retrieved_at timestamptz NOT NULL/i);
  assert.match(sql, /feed_disclosure text NOT NULL/i);
  assert.match(sql, /UNIQUE \(company_id, provider\)/i);
  assert.match(sql, /usable_bar_count DESC, latest_bar_date DESC/i);
});
