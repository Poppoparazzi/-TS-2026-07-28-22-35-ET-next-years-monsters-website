// TS: 2026-08-27 22:58 ET
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync("../.github/workflows/rating-rollout-worker.yml", "utf8");

test("direct rating fallback screens SEC readiness before paid rating attempts", () => {
  assert.match(workflow, /function secFinancialEvidenceReady\(summary, ticker, company\)/);
  assert.match(workflow, /normalizedTicker !== ticker/);
  assert.match(workflow, /!Number\.isInteger\(cik\) \|\| cik <= 0/);
  assert.match(workflow, /sourceUrl\.startsWith\("https:\/\/data\.sec\.gov\/"\)/);
  assert.match(workflow, /!facts \|\| Object\.keys\(facts\)\.length === 0/);
  assert.match(workflow, /ageMs < -futureToleranceMs \|\| ageMs > maxSecFactAgeMs/);
  assert.match(workflow, /expectedCik !== cik/);
  assert.match(workflow, /secReadinessOk && annualRevenuePeriods >= 2/);

  const qualificationIndex = workflow.indexOf("preflightSecRevenueCandidate");
  const paidRatingIndex = workflow.indexOf("/api/ratings/${encodeURIComponent(ticker)}");
  assert.ok(qualificationIndex >= 0, "SEC qualification helper must exist");
  assert.ok(paidRatingIndex > qualificationIndex, "SEC qualification must occur before paid rating requests");
});

test("SEC readiness preflight preserves provider-budget and pacing guards", () => {
  assert.match(workflow, /MAX_DIRECT_FALLBACK_PER_RUN: "8"/);
  assert.match(workflow, /REQUEST_DELAY_MS: "20000"/);
  assert.match(workflow, /SEC_QUALIFICATION_POOL_SIZE: "64"/);
  assert.match(workflow, /SEC_QUALIFICATION_CONCURRENCY: "4"/);
  assert.match(workflow, /MAX_PROTECTED_FALLBACK_PER_RUN: "2"/);
});

test("protected VCL candidates use the same SEC qualification before paid attempts", () => {
  assert.match(workflow, /protectedSecQualificationResults = await mapWithConcurrency\([\s\S]*?preflightSecRevenueCandidate/);
  assert.match(workflow, /qualifiedProtectedCandidates = protectedSecQualificationResults[\s\S]*?secQualificationOk/);
  assert.match(workflow, /protectedVclTickers = Object\.freeze\(\[/);
});

test("paid readiness telemetry preserves every returned reason and missing-evidence item", () => {
  assert.match(workflow, /const reasons = Array\.isArray\(result\.body\?\.reasons\) \? result\.body\.reasons : \[\]/);
  assert.match(workflow, /reasons\.flatMap\(\(reason\) => Array\.isArray\(reason\?\.missingEvidence\) \? reason\.missingEvidence : \[\]\)/);
  assert.match(workflow, /missing=\$\{JSON\.stringify\(missing\)\} reasons=\$\{JSON\.stringify\(reasons\)\}/);
  assert.doesNotMatch(workflow, /missingEvidence.*reasons\[0\]/);
});
