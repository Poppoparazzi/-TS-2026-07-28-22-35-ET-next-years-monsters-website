// TS: 2026-09-14 05:16 UTC

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

test("SEC readiness suppressions remain reusable for 30 days and recover on fresher evidence", () => {
  const sql = EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL.replace(/\s+/g, " ");

  assert.match(
    sql,
    /started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'.*suppressionStage' = 'sec_preflight'.*reasonCode' IN \( 'unresolved_sec_identity', 'insufficient_financial_history' \)/,
  );
  assert.match(sql, /reasonCode' = 'unresolved_sec_identity'.*c\.sec_cik IS NOT NULL.*cps\.sec_status = 'complete'/);
  assert.match(sql, /reasonCode' = 'insufficient_financial_history'.*newer_revenue_fact\.retrieved_at > drr\.started_at/s);
});

test("direct SEC readiness results are persisted before every paid-history path", async () => {
  const app = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
  const directRouteStart = app.indexOf('app.get<{ Params: SymbolParams }>("/api/ratings/:symbol"');
  const directRoute = directRouteStart >= 0 ? app.slice(directRouteStart) : "";
  const unresolvedCheck = directRoute.indexOf("secCompany.cik <= 0 || secFacts.cik !== secCompany.cik");
  const unresolvedPersistence = directRoute.indexOf('reasonCode: "unresolved_sec_identity"');
  const unresolvedReturn = directRoute.indexOf('eligibilityCode: "unresolved_sec_identity"', unresolvedPersistence);
  const financialCheck = directRoute.indexOf("annualRevenuePeriods.length < 2");
  const financialPersistence = directRoute.indexOf('reasonCode: "insufficient_financial_history"');
  const financialReturn = directRoute.indexOf('eligibilityCode: "insufficient_financial_history"', financialPersistence);
  const securityTypePreflight = directRoute.indexOf("getSecFundSecurityTypeEvidence(symbol)");
  const securityPersistence = directRoute.indexOf('reasonCode: "unsupported_security_type"');
  const securityReturn = directRoute.indexOf('eligibilityCode: "unsupported_security_type"', securityPersistence);
  const historyLoader = directRoute.indexOf("loadDirectCompanyHistoryWithLease({");
  const benchmarkHistory = directRoute.indexOf('provider.getDailyHistory("SPY", 300)');

  assert.ok(directRouteStart >= 0, "direct rating route must remain present");
  assert.ok(unresolvedCheck >= 0 && unresolvedCheck < unresolvedPersistence, "identity readiness must be checked before persistence");
  assert.ok(unresolvedPersistence >= 0 && unresolvedPersistence < unresolvedReturn, "unresolved identity must be persisted before early return");
  assert.ok(financialCheck >= 0 && financialCheck < financialPersistence, "financial readiness must be checked before persistence");
  assert.ok(financialPersistence >= 0 && financialPersistence < financialReturn, "insufficient financial history must be persisted before early return");
  assert.ok(securityTypePreflight >= 0 && securityTypePreflight < securityPersistence, "authoritative SEC classification must precede suppression persistence");
  assert.ok(securityPersistence >= 0 && securityPersistence < securityReturn, "unsupported-security suppression must be persisted before early return");
  assert.ok(unresolvedReturn >= 0 && unresolvedReturn < historyLoader, "unresolved SEC identity must return before the quota-safe company-history path");
  assert.ok(financialReturn >= 0 && financialReturn < historyLoader, "insufficient SEC financial history must return before the quota-safe company-history path");
  assert.ok(securityReturn >= 0 && securityReturn < historyLoader, "unsupported security types must return before the quota-safe company-history path");
  assert.ok(historyLoader >= 0 && historyLoader < benchmarkHistory, "company history must pass through the lease-safe helper before benchmark quota is spent");
  assert.equal(directRoute.indexOf("provider.getDailyHistory(symbol, 300)"), -1, "direct route must not bypass the lease-safe helper with a company-history provider call");

  const helperSource = await readFile(new URL("../src/ratings/direct-company-history.ts", import.meta.url), "utf8");
  const helperStart = helperSource.indexOf("export async function loadDirectCompanyHistoryWithLease");
  const helper = helperStart >= 0 ? helperSource.slice(helperStart) : "";
  const helperClaim = helper.indexOf("tryClaimMarketHistoryRequest(");
  const helperPaidHistory = helper.indexOf("input.marketProvider.getDailyHistory(input.ticker, 300)");
  assert.ok(helperClaim >= 0 && helperClaim < helperPaidHistory, "paid company history must remain behind the atomic database lease inside the helper");

  const persistenceSource = await readFile(new URL("../src/ratings/direct-sec-suppression.ts", import.meta.url), "utf8");
  assert.match(persistenceSource, /"unresolved_sec_identity"/);
  assert.match(persistenceSource, /"insufficient_financial_history"/);
  assert.match(persistenceSource, /"unsupported_security_type"/);
  assert.match(persistenceSource, /ratingVersion:\s*MONSTER_RATING_ENGINE_VERSION/);
  assert.match(persistenceSource, /reasonCode:\s*input\.reasonCode/);
  assert.match(persistenceSource, /suppressionStage:\s*input\.suppressionStage/);
  assert.match(persistenceSource, /replaceable:\s*protectedCandidate\s*\?\s*\[\]\s*:\s*\[failure\]/);
  assert.match(persistenceSource, /INSERT INTO data_refresh_runs/);
});
