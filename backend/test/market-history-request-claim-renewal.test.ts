// TS: 2026-09-05 21:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL("../database/migrations/1013_renew_market_history_request_claim.sql", import.meta.url);

test("market-history claims are renewable only by the current owner before expiry", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(
    sql,
    /market_history_request_claims\.expires_at <= CURRENT_TIMESTAMP\s+OR market_history_request_claims\.run_id IS NOT DISTINCT FROM EXCLUDED\.run_id/,
    "an expired claim may be taken over, while an unexpired claim may only be renewed by its current run",
  );
  assert.match(
    sql,
    /WHEN market_history_request_claims\.run_id IS NOT DISTINCT FROM EXCLUDED\.run_id\s+THEN market_history_request_claims\.claimed_at/,
    "renewal must preserve the original claimed_at rather than disguising the age of the claim",
  );
  assert.match(
    sql,
    /GREATEST\(60, LEAST\(COALESCE\(p_lease_seconds, 900\), 3600\)\)/,
    "renewed leases must remain bounded to one hour",
  );
});
