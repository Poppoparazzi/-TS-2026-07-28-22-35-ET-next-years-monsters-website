// TS: 2026-08-29 09:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStorePath = new URL("../src/ratings/batch-store.ts", import.meta.url);

test("rating candidate selection suppresses recent ordinary failures without suppressing protected repair candidates", async () => {
  const source = await readFile(batchStorePath, "utf8");

  assert.match(
    source,
    /export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `[^`]*data_refresh_runs[^`]*metadata -> 'replaceable'[^`]*INTERVAL '7 days'[^`]*prior_failure ->> 'ticker' = c\.ticker[^`]*`/s,
    "candidate selection must reuse recent structured ordinary-failure metadata for a seven-day cooldown",
  );
  assert.match(
    source,
    /AND \$\{EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL\}/,
    "the recent ordinary-failure exclusion must participate in the production candidate query",
  );
  assert.doesNotMatch(
    source,
    /metadata -> 'protectedMustRepair'/,
    "protected/VCL must-repair candidates must not be suppressed by the ordinary failure cooldown",
  );
});
