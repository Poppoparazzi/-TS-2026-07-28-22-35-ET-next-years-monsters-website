// TS: 2026-09-08 16:58 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../database/migrations/1034_rating_replaceable_failure_preflight_index.sql", import.meta.url),
  "utf8",
);
const batchStore = readFileSync(new URL("../src/ratings/batch-store.ts", import.meta.url), "utf8");

test("recent replaceable rating failures stay on an indexed free preflight path", () => {
  assert.match(migration, /data_refresh_runs_ratings_replaceable_gin_idx/);
  assert.match(migration, /USING GIN \(\(metadata -> 'replaceable'\) jsonb_path_ops\)/);
  assert.match(migration, /WHERE refresh_type = 'ratings'/);
  assert.match(batchStore, /drr\.metadata -> 'replaceable' @> jsonb_build_array/);
  assert.match(batchStore, /drr\.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'/);
  assert.match(batchStore, /prior_failure ->> 'ticker' = c\.ticker/);
});
