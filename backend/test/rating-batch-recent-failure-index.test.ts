// TS: 2026-09-06 18:57 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../database/migrations/1014_recent_rating_failure_lookup_index.sql", import.meta.url);
const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("recent SEC-preflight suppression lookup is backed by a rating-run time index", async () => {
  const [migration, batchStore] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(batchStorePath, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS data_refresh_runs_recent_rating_started_idx[\s\S]*ON data_refresh_runs \(started_at DESC\)[\s\S]*WHERE refresh_type = 'ratings'/,
    "the 5,000-candidate suppression preflight should not repeatedly scan unrelated refresh-run history",
  );
  assert.match(
    batchStore,
    /EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `[\s\S]*drr\.refresh_type = 'ratings'[\s\S]*drr\.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'/,
    "candidate suppression must stay bounded to the same recent rating-run slice covered by the partial index",
  );
});
