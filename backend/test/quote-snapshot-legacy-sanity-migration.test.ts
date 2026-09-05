// TS: 2026-09-05 11:57 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL(
  "../database/migrations/1011_cleanup_legacy_quote_timestamp_anomalies.sql",
  import.meta.url,
);

test("legacy impossible quote timestamps are removed without fabricating provider data", async () => {
  const migration = await readFile(MIGRATION_PATH, "utf8");

  assert.match(migration, /DELETE FROM quote_snapshots/);
  assert.match(
    migration,
    /provider_timestamp > retrieved_at \+ INTERVAL '5 minutes'/,
  );
  assert.match(
    migration,
    /retrieved_at > clock_timestamp\(\) \+ INTERVAL '5 minutes'/,
  );
  assert.doesNotMatch(migration, /UPDATE\s+quote_snapshots/i);
  assert.doesNotMatch(migration, /SET\s+provider_timestamp/i);
});
