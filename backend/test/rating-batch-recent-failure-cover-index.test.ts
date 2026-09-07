// TS: 2026-09-06 20:03 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../database/migrations/1015_cover_recent_rating_failure_metadata.sql", import.meta.url);
const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("recent SEC-preflight suppression metadata is covered by the rating-run time index", async () => {
  const [migration, batchStore] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(batchStorePath, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS data_refresh_runs_recent_rating_started_cover_idx[\s\S]*ON data_refresh_runs \(started_at DESC\)[\s\S]*INCLUDE \(metadata\)[\s\S]*WHERE refresh_type = 'ratings'/,
    "recent rating suppression should read metadata from the bounded covering index when PostgreSQL visibility permits",
  );
  assert.match(
    batchStore,
    /EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `[\s\S]*jsonb_array_elements[\s\S]*drr\.refresh_type = 'ratings'[\s\S]*drr\.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'/,
    "the covering index must stay aligned with the bounded JSON suppression lookup it accelerates",
  );
});
