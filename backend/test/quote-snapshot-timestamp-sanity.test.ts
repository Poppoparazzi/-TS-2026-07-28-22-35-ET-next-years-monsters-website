// TS: 2026-09-05 06:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/1009_quote_snapshot_timestamp_sanity.sql",
  import.meta.url,
);

test("quote snapshot persistence rejects future provider and retrieval timestamps", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /NEW\.provider_timestamp\s*>\s*NEW\.retrieved_at\s*\+\s*INTERVAL\s+'5 minutes'/i,
  );
  assert.match(sql, /quote_snapshot_future_provider_timestamp/);
  assert.match(
    sql,
    /NEW\.retrieved_at\s*>\s*clock_timestamp\(\)\s*\+\s*INTERVAL\s+'5 minutes'/i,
  );
  assert.match(sql, /quote_snapshot_future_retrieved_at/);
  assert.match(
    sql,
    /BEFORE INSERT OR UPDATE OF provider_timestamp, retrieved_at\s+ON quote_snapshots/i,
  );
});
