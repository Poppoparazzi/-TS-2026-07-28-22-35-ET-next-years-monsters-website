// TS: 2026-08-30 12:25 ET
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const workflow = readFileSync("../.github/workflows/rating-rollout-worker.yml", "utf8");

function extractFunction(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `expected ${functionName} in rollout worker`);
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `expected ${functionName} function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${functionName} function body`);
}

function loadWorkerAnnualRevenuePolicy(): {
  annualRevenuePeriodCount: (summary: Record<string, unknown>) => number;
  latestAnnualRevenueValue: (summary: Record<string, unknown>) => number;
} {
  const source = [
    extractFunction(workflow, "buildAnnualFinancialPeriods"),
    extractFunction(workflow, "annualRevenuePeriodCount"),
    extractFunction(workflow, "latestAnnualRevenueValue"),
    "({ annualRevenuePeriodCount, latestAnnualRevenueValue })",
  ].join("\n");
  return runInNewContext(source, {
    annualForms: new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]),
    financialMetricKeys: Object.freeze([
      "revenue", "grossProfit", "operatingIncome", "netIncome", "dilutedEps",
      "assets", "liabilities", "shareholdersEquity", "cash", "operatingCashFlow",
    ]),
  }) as {
    annualRevenuePeriodCount: (summary: Record<string, unknown>) => number;
    latestAnnualRevenueValue: (summary: Record<string, unknown>) => number;
  };
}

function annualFact(fiscalYear: number | null, metricValue: number): Record<string, unknown> {
  const year = fiscalYear ?? 2000;
  return {
    fiscalYear,
    fiscalPeriod: "FY",
    form: "10-K",
    value: metricValue,
    periodEnd: `${year}-12-31`,
    filed: `${year + 1}-02-15`,
  };
}

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

test("annual revenue preflight mirrors the rating engine's latest-five financial-period window", () => {
  const { annualRevenuePeriodCount, latestAnnualRevenueValue } = loadWorkerAnnualRevenuePolicy();
  const displacedRevenue = {
    history: {
      revenue: [2015, 2016, 2017, null].map((year, index) => annualFact(year, 1_000 + index)),
      assets: [2021, 2022, 2023, 2024, 2025].map((year) => annualFact(year, 50_000 + year)),
    },
    facts: {},
  };
  const oneRevenuePeriod = {
    history: {
      revenue: [2018, 2019, 2020].map((year, index) => annualFact(year, 2_000 + index)),
      assets: [2022, 2023, 2024, 2025].map((year) => annualFact(year, 60_000 + year)),
    },
    facts: {},
  };
  const readyRevenue = {
    history: {
      revenue: [2021, 2022, 2023, 2024, 2025].map((year) => annualFact(year, year * 1_000)),
    },
    facts: {},
  };

  assert.equal(annualRevenuePeriodCount(displacedRevenue), 0);
  assert.equal(annualRevenuePeriodCount(oneRevenuePeriod), 1);
  assert.equal(annualRevenuePeriodCount(readyRevenue), 5);
  assert.equal(latestAnnualRevenueValue(readyRevenue), 2_025_000);
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
