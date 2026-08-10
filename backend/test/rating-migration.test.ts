// TS: 2026-08-09 12:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/9999_production_rating_engine_v1.sql",
  import.meta.url,
);

async function migrationSql(): Promise<string> {
  return readFile(migrationUrl, "utf8");
}

test("production rating migration is transactional and preserves existing company data", async () => {
  const sql = await migrationSql();

  assert.match(sql, /^-- TS: 2026-08-09/m);
  assert.match(sql, /BEGIN;/);
  assert.match(sql, /COMMIT;/);
  assert.doesNotMatch(sql, /DROP TABLE/i);
  assert.doesNotMatch(sql, /TRUNCATE/i);
  assert.doesNotMatch(sql, /DELETE FROM companies/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS market_daily_bars/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rating_eligibility_results/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rating_batch_runs/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS rating_batch_items/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS provider_health_snapshots/);
});

test("production rating migration upgrades tier and score constraints explicitly", async () => {
  const sql = await migrationSql();

  assert.match(sql, /SET tier = 'Bronze'\s+WHERE tier = 'Watch'/);
  assert.match(sql, /SET tier = 'Cemetery Risk'\s+WHERE tier = 'Cemetery'/);
  for (const tier of [
    "Platinum",
    "Gold",
    "Silver",
    "Bronze",
    "Goblin",
    "Cemetery Risk",
    "Tier Boundary Unresolved",
  ]) {
    assert.equal(sql.includes(`'${tier}'`), true);
  }
  assert.match(sql, /score >= 1 AND score <= 100/);
  assert.match(sql, /data_completeness_score/);
  assert.match(sql, /result_payload jsonb/);
  assert.match(sql, /prior_rating_run_id/);
  assert.match(sql, /change_reasons jsonb/);
});

test("rating batch schema provides resumability, retries, cancellation, and reconciliation", async () => {
  const sql = await migrationSql();

  assert.match(sql, /cancellation_requested boolean/);
  assert.match(sql, /heartbeat_at timestamptz/);
  assert.match(sql, /attempt_count integer/);
  assert.match(sql, /next_retry_at timestamptz/);
  assert.match(sql, /last_error text/);
  assert.match(sql, /rating_batch_item_unique UNIQUE \(batch_run_id, company_id\)/);
  assert.match(sql, /rated_count \+ unrated_count \+ failed_count <= claimed_count/);
  assert.match(sql, /status IN \('pending', 'processing', 'rated', 'unrated', 'failed', 'cancelled'\)/);
});
