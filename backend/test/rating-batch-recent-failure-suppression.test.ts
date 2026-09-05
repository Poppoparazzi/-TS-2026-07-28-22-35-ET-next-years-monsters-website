// TS: 2026-09-05 08:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating candidate selection leaves market-history retry suppression to durable latest evidence", async () => {
  const source = await readFile(batchStorePath, "utf8");
  const recentFailureSql = source.match(/export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `([\s\S]*?)`;/)?.[1];
  assert.ok(recentFailureSql, "recent replaceable failure SQL must remain defined");

  assert.match(
    recentFailureSql,
    /data_refresh_runs[\s\S]*metadata -> 'replaceable'[\s\S]*INTERVAL '30 days'[\s\S]*prior_failure ->> 'ticker' = c\.ticker[\s\S]*'unresolved_sec_identity'[\s\S]*'insufficient_financial_history'[\s\S]*'unsupported_security_type'/,
    "run metadata should retain only structural non-market-data cooldown reasons",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /insufficient_market_history|insufficient_liquidity|stale_market_data|stored_market_history_preflight|rating_engine/,
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
    "structural ordinary-ineligibility cooldown must still participate in the production candidate query",
  );
  assert.doesNotMatch(
    recentFailureSql,
    /metadata -> 'protectedMustRepair'/,
    "protected/VCL must-repair candidates must not be suppressed by the ordinary failure cooldown",
  );
});
