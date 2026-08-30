// TS: 2026-08-30 12:26 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRolloutWorker(): string {
  return readFileSync(
    new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
    "utf8",
  );
}

test("protected VCL candidates must pass free stored-data and SEC revenue preflight before paid rating attempts", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(
    rolloutWorker,
    /protectedPreflightResults\s*=\s*await mapWithConcurrency\([\s\S]*?protectedCandidates,[\s\S]*?preflightStoredCandidate/,
    "protected VCL candidates must use the free stored-data preflight helper before paid selection",
  );
  assert.match(
    rolloutWorker,
    /verifiedProtectedPreflight\s*=\s*protectedPreflightResults\.filter\(\(item\) => item\.preflightOk\)/,
    "only protected candidates with successful stored-data preflight may advance to SEC qualification",
  );
  assert.match(
    rolloutWorker,
    /protectedSecQualificationResults\s*=\s*await mapWithConcurrency\([\s\S]*?verifiedProtectedPreflight,[\s\S]*?secQualificationConcurrency,[\s\S]*?preflightSecRevenueCandidate/,
    "protected candidates must pass the free SEC annual-revenue qualification stage before paid selection",
  );
  assert.match(
    rolloutWorker,
    /qualifiedProtectedCandidates\s*=\s*protectedSecQualificationResults[\s\S]*?\.filter\(\(item\) => item\.secQualificationOk\)[\s\S]*?\.map\(\(item\) => item\.company\)/,
    "only SEC-qualified protected candidates may enter the paid protected cohort",
  );
  assert.match(
    rolloutWorker,
    /protectedAttemptCount\s*=\s*Math\.min\([\s\S]*?qualifiedProtectedCandidates\.length,[\s\S]*?maxProtectedFallbackPerRun,[\s\S]*?directFallbackBudget/,
    "protected paid attempts must remain bounded by SEC-qualified availability and the existing quota caps",
  );
  assert.doesNotMatch(
    rolloutWorker,
    /selectedProtectedCandidates\s*=\s*Array\.from\([\s\S]*?protectedCandidates\[/,
    "paid protected selection must not bypass the free preflight stages by indexing directly into raw protected candidates",
  );
});

test("ordinary candidates must have two annual SEC revenue periods before paid rating attempts", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(rolloutWorker, /SEC_QUALIFICATION_POOL_SIZE:\s*"64"/);
  assert.match(rolloutWorker, /SEC_QUALIFICATION_CONCURRENCY:\s*"4"/);
  assert.match(
    rolloutWorker,
    /annualForms\s*=\s*new Set\(\["10-K", "10-K\/A", "20-F", "20-F\/A", "40-F", "40-F\/A"\]\)/,
    "SEC qualification must use the same annual filing forms as the rating input builder",
  );
  assert.match(
    rolloutWorker,
    /function buildAnnualFinancialPeriods\(summary\)[\s\S]*?financialMetricKeys[\s\S]*?fiscalPeriod !== "FY"[\s\S]*?\.slice\(-5\)[\s\S]*?function annualRevenuePeriodCount\(summary\)[\s\S]*?period\.values\.revenue/,
    "free SEC qualification must mirror the rating engine's latest-five financial-period revenue window",
  );
  assert.match(
    rolloutWorker,
    /preflightSecRevenueCandidate[\s\S]*?\/api\/sec\/facts\/\$\{encodeURIComponent\(ticker\)\}[\s\S]*?annualRevenuePeriods >= 2/,
    "SEC qualification must use the existing free production SEC facts route and require two annual revenue periods",
  );
  assert.match(
    rolloutWorker,
    /secQualificationPool\s*=\s*rankedStoredPreflightResults\.slice\([\s\S]*?secQualificationPoolSize/,
    "only a bounded stored-data shortlist may enter the SEC qualification stage",
  );
  assert.match(
    rolloutWorker,
    /qualifiedOrdinaryCandidates\s*=\s*secQualificationResults[\s\S]*?\.filter\(\(item\) => item\.secQualificationOk\)[\s\S]*?\.slice\(0, ordinaryAttemptCount\)/,
    "only SEC-qualified ordinary candidates may consume the paid fallback budget",
  );
  assert.match(rolloutWorker, /MAX_DIRECT_FALLBACK_PER_RUN:\s*"8"/);
  assert.match(rolloutWorker, /REQUEST_DELAY_MS:\s*"20000"/);
});
