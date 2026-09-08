// TS: 2026-09-08 06:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL(
  "../database/migrations/1027_canonicalize_dominating_history_cache.sql",
  import.meta.url,
);

test("larger equally-fresh paid history prunes only dominated smaller cache rows", async () => {
  const source = await readFile(MIGRATION_PATH, "utf8");

  assert.match(source, /symbol = NEW\.symbol/);
  assert.match(source, /provider = NEW\.provider/);
  assert.match(source, /output_size < NEW\.output_size/);
  assert.match(source, /retrieved_at <= NEW\.retrieved_at/);
  assert.match(source, /AFTER INSERT OR UPDATE OF bars, retrieved_at, feed_disclosure/);
  assert.doesNotMatch(source, /output_size > NEW\.output_size/);
});
