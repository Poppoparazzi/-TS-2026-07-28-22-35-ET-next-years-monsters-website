// TS: 2026-09-12 19:02 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL } from "../src/ratings/batch-store.js";

test("SEC unsupported-security suppression remains reusable for the current rating version", () => {
  const sql = EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL.replace(/\s+/g, " ");

  assert.match(
    sql,
    /suppressionStage' = 'sec_preflight'.*reasonCode' = 'unsupported_security_type'.*ratingVersion' = \$2/,
  );

  const thirtyDayBlock = sql.match(/started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'.*?\)\s*OR\s*\(/)?.[0] ?? "";
  assert.doesNotMatch(thirtyDayBlock, /unsupported_security_type/);
});
