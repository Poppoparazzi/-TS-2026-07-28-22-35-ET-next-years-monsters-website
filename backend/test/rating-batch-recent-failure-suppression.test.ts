// TS: 2026-08-29 12:59 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating candidate selection suppresses only recent structured ordinary ineligibility outcomes", async () => {
  const source = await readFile(batchStorePath, "utf8");

  assert.match(
    source,
    /export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `[^`]*data_refresh_runs[^`]*metadata -> 'replaceable'[^`]*INTERVAL '7 days'[^`]*prior_failure ->> 'ticker' = c\.ticker[^`]*prior_failure ->> 'reasonCode' IS NOT NULL[^`]*prior_failure ->> 'suppressionStage' IN \('sec_preflight', 'rating_engine'\)[^`]*prior_failure ->> 'reasonCode' <> 'candidate_processing_error'[^`]*`/s,
    "candidate selection must reuse only structured evidence-based ineligibility metadata for the seven-day cooldown",
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
