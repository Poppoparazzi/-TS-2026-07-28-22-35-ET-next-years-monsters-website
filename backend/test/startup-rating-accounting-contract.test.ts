// TS: 2026-08-23 21:04 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const startupSource = readFileSync(
  new URL("../src/jobs/startup-rating-batch.ts", import.meta.url),
  "utf8",
);

test("startup rating recovery uses the authoritative current-version rating count", () => {
  assert.match(
    startupSource,
    /const\s+alreadyRatedCount\s*=\s*universeStatus\.ratingCompleteCount/,
    "startup recovery must use the universe status current-version rating count directly",
  );
  assert.doesNotMatch(
    startupSource,
    /secEvidenceReadyCount\s*-\s*currentVersionUnratedCandidates\.length/,
    "startup recovery must not infer completed ratings by subtracting a second 5,000-company candidate scan",
  );
  assert.doesNotMatch(
    startupSource,
    /currentVersionUnratedCandidates\s*=|\[universeStatus,\s*currentVersionUnratedCandidates\]/,
    "startup recovery must not issue a duplicate full candidate query merely to count completed ratings",
  );
  assert.match(
    startupSource,
    /remainingTargetCount\s*=\s*Math\.max\(desiredTargetCount\s*-\s*alreadyRatedCount,\s*0\)/,
    "startup recovery must request only the remaining distance to the configured rating target",
  );
});
