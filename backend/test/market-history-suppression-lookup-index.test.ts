// TS: 2026-09-08 08:05 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL(
  "../database/migrations/1028_market_history_suppression_lookup_covering_index.sql",
  import.meta.url,
);

test("durable market-history suppression lookup is covered before paid history calls", async () => {
  const sql = await readFile(MIGRATION_PATH, "utf8");

  assert.match(
    sql,
    /ON market_history_evidence \(\s*company_id,\s*provider\s*\)/s,
  );
  assert.match(
    sql,
    /INCLUDE \(\s*rating_eligibility_code,\s*suppression_reason,\s*usable_bar_count,\s*retrieved_at\s*\)/s,
  );
});
