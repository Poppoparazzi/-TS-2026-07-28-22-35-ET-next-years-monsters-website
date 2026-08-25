// TS: 2026-08-25 09:07 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRolloutWorker(): string {
  return readFileSync(
    new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
    "utf8",
  );
}

test("protected VCL candidates must pass free stored-data preflight before paid rating attempts", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(
    rolloutWorker,
    /protectedPreflightResults\s*=\s*await mapWithConcurrency\([\s\S]*?protectedCandidates,[\s\S]*?preflightStoredCandidate/,
    "protected VCL candidates must use the same free stored-data preflight helper before paid selection",
  );
  assert.match(
    rolloutWorker,
    /verifiedProtectedCandidates\s*=\s*protectedPreflightResults[\s\S]*?\.filter\(\(item\) => item\.preflightOk\)[\s\S]*?\.map\(\(item\) => item\.company\)/,
    "only protected candidates with successful free preflight may enter the paid protected cohort",
  );
  assert.match(
    rolloutWorker,
    /protectedAttemptCount\s*=\s*Math\.min\([\s\S]*?verifiedProtectedCandidates\.length,[\s\S]*?maxProtectedFallbackPerRun,[\s\S]*?directFallbackBudget/,
    "protected paid attempts must remain bounded by verified preflight availability and the existing quota caps",
  );
  assert.match(
    rolloutWorker,
    /const candidates = \[[\s\S]*?\.\.\.selectedProtectedCandidates,[\s\S]*?\.\.\.rankedOrdinaryCandidates/,
    "verified protected candidates must retain first priority without making failed protected preflights replaceable",
  );
  assert.doesNotMatch(
    rolloutWorker,
    /selectedProtectedCandidates\s*=\s*Array\.from\([\s\S]*?protectedCandidates\[/,
    "paid protected selection must not bypass free preflight by indexing directly into raw protected candidates",
  );
});
