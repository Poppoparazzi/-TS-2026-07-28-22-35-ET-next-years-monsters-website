// TS: 2026-09-07 20:59 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../database/migrations/1023_rating_failure_metadata_gin.sql", import.meta.url);

test("rating failure suppression metadata has a JSONB containment index", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /USING gin \(\(metadata -> 'replaceable'\) jsonb_path_ops\)/);
  assert.match(sql, /WHERE refresh_type = 'ratings'/);
});
