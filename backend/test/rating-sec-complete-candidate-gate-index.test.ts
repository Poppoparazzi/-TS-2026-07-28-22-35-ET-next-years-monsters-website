// TS: 2026-09-08 11:09 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../database/migrations/1029_rating_sec_complete_candidate_gate_index.sql",
  import.meta.url,
);

const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating candidate selection has a narrow SEC-complete company gate before paid history work", async () => {
  const [migration, batchStore] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(batchStoreUrl, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE INDEX IF NOT EXISTS company_pipeline_rating_sec_complete_candidate_idx\s+ON company_pipeline_status \(company_id\)\s+WHERE sec_status = 'complete'/s,
  );
  assert.match(
    batchStore,
    /JOIN company_pipeline_status cps ON cps\.company_id = c\.id[\s\S]*WHERE c\.is_active = true AND cps\.sec_status = 'complete' AND c\.sec_cik IS NOT NULL/,
  );
});
