// TS: 2026-09-13 07:08 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("direct SEC unsupported-security result is persisted before every paid-history path", async () => {
  const app = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
  const directRouteStart = app.indexOf('app.get<{ Params: SymbolParams }>("/api/ratings/:symbol"');
  const directRoute = directRouteStart >= 0 ? app.slice(directRouteStart) : "";
  const securityTypePreflight = directRoute.indexOf("getSecFundSecurityTypeEvidence(symbol)");
  const persistence = directRoute.indexOf("persistDirectSecSuppression({");
  const unsupportedReturn = directRoute.indexOf('eligibilityCode: "unsupported_security_type"', persistence + 1);
  const persistenceFailureReturn = directRoute.indexOf('eligibilityCode: "sec_security_type_suppression_persistence_unavailable"');
  const claim = directRoute.indexOf("tryClaimMarketHistoryRequest(");
  const paidHistory = directRoute.indexOf("provider.getDailyHistory(symbol, 300)");

  assert.ok(directRouteStart >= 0, "direct rating route must remain present");
  assert.ok(securityTypePreflight >= 0 && securityTypePreflight < persistence, "authoritative SEC classification must precede suppression persistence");
  assert.ok(persistence >= 0 && persistence < unsupportedReturn, "unsupported-security suppression must be persisted before the early Not Yet Rated return");
  assert.ok(persistenceFailureReturn >= 0 && persistenceFailureReturn < claim, "persistence failure must fail closed before any paid-history lease");
  assert.ok(unsupportedReturn >= 0 && unsupportedReturn < claim, "unsupported security types must return before any paid-history lease");
  assert.ok(claim >= 0 && claim < paidHistory, "paid history must remain behind the atomic database lease");

  const persistenceSource = await readFile(new URL("../src/ratings/direct-sec-suppression.ts", import.meta.url), "utf8");
  assert.match(persistenceSource, /ratingVersion:\s*MONSTER_RATING_ENGINE_VERSION/);
  assert.match(persistenceSource, /reasonCode:\s*input\.reasonCode/);
  assert.match(persistenceSource, /suppressionStage:\s*input\.suppressionStage/);
  assert.match(persistenceSource, /replaceable:\s*protectedCandidate\s*\?\s*\[\]\s*:\s*\[failure\]/);
  assert.match(persistenceSource, /INSERT INTO data_refresh_runs/);
});
