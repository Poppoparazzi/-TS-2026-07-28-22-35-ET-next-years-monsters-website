// TS: 2026-09-04 13:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL } from "../src/ratings/batch-store.js";

const migrationUrl = new URL(
  "../database/migrations/1008_expose_market_history_suppression_in_latest_view.sql",
  import.meta.url,
);

test("latest market-history view exposes durable suppression fields", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /mhe\.rating_eligibility_code/i);
  assert.match(sql, /mhe\.suppression_reason/i);
});

test("candidate SQL excludes fresh durable liquidity suppressions before paid calls", () => {
  assert.match(
    EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL,
    /mhe\.suppression_reason\s*=\s*'insufficient_liquidity'/i,
  );
  assert.match(
    EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL,
    /mhe\.retrieved_at\s*\+\s*INTERVAL\s*'30 days'/i,
  );
});
