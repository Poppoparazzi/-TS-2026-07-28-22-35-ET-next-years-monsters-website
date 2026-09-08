// TS: 2026-09-08 00:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL(
  "../database/migrations/1024_cross_size_history_refresh_lease.sql",
  import.meta.url,
);

test("paid history refresh leases serialize across output sizes", async () => {
  const source = await readFile(MIGRATION_PATH, "utf8");

  assert.match(source, /pg_advisory_xact_lock\(hashtext\(NEW\.symbol\), hashtext\(NEW\.provider\)\)/);
  assert.match(source, /existing\.output_size <> NEW\.output_size/);
  assert.match(source, /existing\.claimed_until > now\(\)/);
  assert.match(source, /RETURN NULL;/);
  assert.match(source, /BEFORE INSERT ON benchmark_history_refresh_claims/);
});
