// TS: 2026-09-07 05:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../database/migrations/1019_rating_completed_candidate_exclusion_index.sql", import.meta.url);
const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("completed-rating exclusion stays aligned with its narrow quota-safe index", async () => {
  const [migration, batchStore] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(batchStoreUrl, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS monster_rating_runs_completed_company_version_idx[\s\S]*ON monster_rating_runs \(company_id, rating_version\)[\s\S]*WHERE status = 'complete'/,
    "completed ratings should have a narrow company/version partial index",
  );

  assert.match(
    batchStore,
    /NOT EXISTS \([\s\S]*FROM monster_rating_runs mrr[\s\S]*mrr\.company_id = c\.id[\s\S]*mrr\.rating_version = \$2[\s\S]*mrr\.status = 'complete'[\s\S]*\)/,
    "candidate selection must exclude current-version completed ratings before quota-bearing work",
  );

  assert.match(
    batchStore,
    /WHERE c\.is_active = true[\s\S]*\$\{EXCLUDE_CURRENT_COMPLETED_RATING_SQL\}[\s\S]*\$\{EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL\}[\s\S]*\$\{EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL\}/,
    "free completed-rating and persisted-suppression exclusions must remain in candidate selection before the paid-history worker loop",
  );
});
