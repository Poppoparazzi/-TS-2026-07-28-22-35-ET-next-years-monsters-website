// TS: 2026-09-07 12:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL("../database/migrations/1022_market_history_candidate_priority_covering_index.sql", import.meta.url);

test("candidate priority index covers latest market-history evidence used by quota-safe ranking", async () => {
  const sql = await readFile(MIGRATION_PATH, "utf8");

  assert.match(sql, /ON market_history_evidence \(\s*company_id,\s*retrieved_at DESC,\s*usable_bar_count DESC,\s*latest_bar_date DESC\s*\)/s);
  assert.match(sql, /INCLUDE \(\s*twenty_session_average_dollar_volume,\s*rating_eligibility_code,\s*suppression_reason,\s*provider\s*\)/s);
});
