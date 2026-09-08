// TS: 2026-09-08 01:14 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/1025_refresh_claim_lookup_index.sql",
  import.meta.url,
);

test("active cross-size refresh claims have a symbol/provider expiry lookup index", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS idx_benchmark_history_refresh_claim_active_lookup[\s\S]*ON benchmark_history_refresh_claims \(symbol, provider, claimed_until DESC\)[\s\S]*INCLUDE \(output_size, claim_token\)/,
    "cross-size quota coordination must have a direct active-lease lookup path",
  );
});
