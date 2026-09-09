// TS: 2026-09-09 01:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating candidate selection reuses durable structural and engine-version ineligibility", async () => {
  const source = await readFile(batchStorePath, "utf8");
  const recentFailureSql = source.match(/export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `([\s\S]*?)`;/)?.[1];
  assert.ok(recentFailureSql, "recent replaceable failure SQL must remain defined");

  assert.match(
    recentFailureSql,
    /data_refresh_runs[\s\S]*metadata -> 'replaceable'[\s\S]*prior_failure ->> 'ticker' = c\.ticker[\s\S]*drr\.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'[\s\S]*prior_failure ->> 'suppressionStage' = 'sec_preflight'[\s\S]*'unresolved_sec_identity'[\s\S]*'insufficient_financial_history'[\s\S]*'unsupported_security_type'/,
    "SEC structural cooldowns must remain driven by durable preflight evidence inside the 30-day reconsideration window",
  );
  assert.match(
    recentFailureSql,
    /prior_failure ->> 'suppressionStage' = 'rating_engine'[\s\S]*prior_failure ->> 'reasonCode' = 'unsupported_security_type'[\s\S]*drr\.metadata ->> 'ratingVersion' = \$2/,
    "rating-engine unsupported-security failures must suppress repeat paid attempts for the same rating-engine version",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /WHERE drr\.refresh_type = 'ratings'\s+AND drr\.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'/,
    "the 30-day SEC cooldown must not cap same-version rating-engine unsupported-security suppression",
  );
  assert.match(
    recentFailureSql,
    /prior_failure ->> 'reasonCode' = 'unresolved_sec_identity'[\s\S]*c\.sec_cik IS NOT NULL[\s\S]*cps\.sec_status = 'complete'/,
    "resolved SEC identity must invalidate an older unresolved-identity cooldown",
  );
  assert.match(
    recentFailureSql,
    /prior_failure ->> 'reasonCode' = 'insufficient_financial_history'[\s\S]*newer_revenue_fact\.retrieved_at > drr\.started_at[\s\S]*newer_revenue_fact\.fiscal_period = 'FY'[\s\S]*count\(DISTINCT current_revenue_fact\.fiscal_year\)[\s\S]*>= 2/,
    "insufficient-financial-history cooldowns must reopen only after newer annual revenue evidence raises current depth to at least two fiscal years",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /sec_filings newer_sf|company_facts newer_cf/,
    "generic newer SEC records must not invalidate structural cooldowns regardless of failure reason",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /prior_failure ->> 'reasonCode' = 'unsupported_security_type'[\s\S]{0,160}retrieved_at > drr\.started_at/,
    "unsupported-security suppression must not be directly reopened by unrelated newer SEC data",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /insufficient_market_history|insufficient_liquidity|stale_market_data|stored_market_history_preflight|provider_market_history/,
    "market-history failures must not be double-suppressed by stale run metadata after newer persisted evidence becomes eligible",
  );
  assert.match(
    source,
    /EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL = `[\s\S]*market_history_evidence_latest[\s\S]*insufficient_liquidity[\s\S]*stale_market_data/,
    "durable latest market-history evidence must remain the authority for history/liquidity/staleness retry suppression",
  );
  assert.match(
    source,
    /AND \$\{EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL\}/,
    "structural ordinary-ineligibility suppression must still participate in the production candidate query",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /metadata -> 'protectedMustRepair'/,
    "protected/VCL must-repair candidates must not be suppressed by the ordinary failure cooldown",
  );
});
