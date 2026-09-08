// TS: 2026-09-08 15:09 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_PATH = new URL("../database/migrations/1032_twelve_data_candidate_latest_partial_index.sql", import.meta.url);
const PROVIDER_VIEW_PATH = new URL("../database/migrations/1030_scope_latest_market_history_to_twelve_data.sql", import.meta.url);

test("Twelve Data candidate latest-evidence preflight uses a compact provider partial covering index", async () => {
  const [migration, providerView] = await Promise.all([
    readFile(MIGRATION_PATH, "utf8"),
    readFile(PROVIDER_VIEW_PATH, "utf8"),
  ]);

  assert.match(migration, /ON market_history_evidence \(\s*company_id,\s*retrieved_at DESC,\s*usable_bar_count DESC,\s*latest_bar_date DESC\s*\)/s);
  assert.match(migration, /INCLUDE \(\s*twenty_session_average_dollar_volume,\s*rating_eligibility_code,\s*suppression_reason\s*\)/s);
  assert.match(migration, /WHERE provider = 'twelve-data'/);
  assert.match(providerView, /SELECT DISTINCT ON \(mhe\.company_id\)/);
  assert.match(providerView, /WHERE mhe\.provider = 'twelve-data'/);
});
