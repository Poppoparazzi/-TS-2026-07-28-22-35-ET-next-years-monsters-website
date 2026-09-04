// TS: 2026-09-04 07:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating candidate selection suppresses only recent structural ordinary ineligibility outcomes", async () => {
  const source = await readFile(batchStorePath, "utf8");

  assert.match(
    source,
    /export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `[^`]*data_refresh_runs[^`]*metadata -> 'replaceable'[^`]*INTERVAL '30 days'[^`]*prior_failure ->> 'ticker' = c\.ticker[^`]*prior_failure ->> 'suppressionStage' IN \('sec_preflight', 'rating_engine'\)[^`]*prior_failure ->> 'reasonCode' IN \([^`]*'unresolved_sec_identity'[^`]*'insufficient_financial_history'[^`]*'unsupported_security_type'[^`]*'insufficient_market_history'[^`]*'insufficient_liquidity'[^`]*\)[^`]*`/s,
    "candidate selection must reuse structural evidence-based ineligibility metadata, including proven insufficient liquidity, for the thirty-day cooldown",
  );
  assert.doesNotMatch(
    source,
    /prior_failure ->> 'reasonCode' IS NOT NULL/,
    "the thirty-day cooldown must not suppress every machine-readable failure indiscriminately",
  );
  assert.doesNotMatch(
    source,
    /EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL[^;]*stale_market_data/s,
    "temporary stale-market-data outcomes must remain eligible for a later free/recoverable retry",
  );
  assert.match(
    source,
    /AND \$\{EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL\}/,
    "the structured ordinary-ineligibility exclusion must participate in the production candidate query",
  );
  assert.doesNotMatch(
    source,
    /metadata -> 'protectedMustRepair'/,
    "protected/VCL must-repair candidates must not be suppressed by the ordinary failure cooldown",
  );
});
