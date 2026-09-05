// TS: 2026-09-05 07:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL(
  "../database/migrations/1010_market_history_timestamp_sanity.sql",
  import.meta.url,
);

test("market-history persistence rejects future latest-bar dates and neutralizes legacy invalid dates", async () => {
  const source = await readFile(MIGRATION_PATH, "utf8");

  assert.match(
    source,
    /UPDATE market_history_evidence\s+SET latest_bar_date = NULL\s+WHERE latest_bar_date IS NOT NULL\s+AND latest_bar_date > retrieved_at::date;/s,
  );
  assert.match(source, /CREATE OR REPLACE FUNCTION reject_future_market_history_evidence\(\)/);
  assert.match(source, /NEW\.latest_bar_date > NEW\.retrieved_at::date/);
  assert.match(source, /market_history_evidence_future_latest_bar_date/);
  assert.match(
    source,
    /CREATE TRIGGER market_history_evidence_timestamp_sanity\s+BEFORE INSERT OR UPDATE OF latest_bar_date, retrieved_at/s,
  );
});
