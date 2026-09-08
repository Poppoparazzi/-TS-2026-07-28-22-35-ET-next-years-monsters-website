// TS: 2026-09-08 03:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL(
  "../database/migrations/1026_prune_expired_history_refresh_claims.sql",
  import.meta.url,
);

test("expired paid-history refresh claims are pruned before cross-size suppression", async () => {
  const source = await readFile(MIGRATION_PATH, "utf8");
  const deleteOffset = source.indexOf("DELETE FROM benchmark_history_refresh_claims");
  const activeCheckOffset = source.indexOf("IF EXISTS (");

  assert.match(source, /pg_advisory_xact_lock\(hashtext\(NEW\.symbol\), hashtext\(NEW\.provider\)\)/);
  assert.match(source, /claimed_until <= now\(\)/);
  assert.match(source, /existing\.claimed_until > now\(\)/);
  assert.ok(deleteOffset >= 0, "expired-claim cleanup must exist");
  assert.ok(activeCheckOffset > deleteOffset, "cleanup must happen before the active cross-size claim check");
});
