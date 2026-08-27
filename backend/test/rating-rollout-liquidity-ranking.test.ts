// TS: 2026-08-27 07:17 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRolloutWorker(): string {
  return readFileSync(
    new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
    "utf8",
  );
}

test("SEC-qualified ordinary candidates use stored liquidity only as a paid-attempt ranking signal", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(
    rolloutWorker,
    /storedPrice\s*=\s*Number\(stored\.body\.latestQuote\?\.price\)[\s\S]*?storedVolume\s*=\s*Number\(stored\.body\.latestQuote\?\.volume\)[\s\S]*?storedDollarVolume/,
    "free stored-data preflight must derive a dollar-volume signal from the persisted quote when available",
  );
  assert.match(
    rolloutWorker,
    /qualifiedOrdinaryCandidates\s*=\s*secQualificationResults[\s\S]*?\.filter\(\(item\) => item\.secQualificationOk\)[\s\S]*?\.sort\(\(left, right\) => \{[\s\S]*?storedDollarVolume[\s\S]*?rightLiquidity - leftLiquidity[\s\S]*?\.slice\(0, ordinaryAttemptCount\)/,
    "SEC-qualified ordinary candidates should prefer stronger free stored liquidity evidence before paid attempts",
  );
  assert.doesNotMatch(
    rolloutWorker,
    /\.filter\(\(item\) =>[^\n]*storedDollarVolume/,
    "stored liquidity must not become a hard eligibility filter because the rating engine uses multi-day average liquidity",
  );
  assert.match(rolloutWorker, /MAX_DIRECT_FALLBACK_PER_RUN:\s*"8"/);
  assert.match(rolloutWorker, /REQUEST_DELAY_MS:\s*"20000"/);
  assert.match(
    rolloutWorker,
    /const candidates = \[[\s\S]*?\.\.\.selectedProtectedCandidates,[\s\S]*?\.\.\.qualifiedOrdinaryCandidates/,
    "protected VCL priority must remain ahead of liquidity-ranked ordinary candidates",
  );
});
