// TS: 2026-08-09 18:06 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { SecCompanyFactsSummary } from "../src/sec/types.js";
import { evaluateProductionRating } from "../src/ratings/evaluator.js";

const secFacts: SecCompanyFactsSummary = {
  cik: "0000320193",
  companyName: "Apple Inc.",
  retrievedAt: "2026-08-09T21:55:00Z",
  facts: {},
  sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
  disclosure: "SEC company facts",
};

const incompleteSource = {
  symbol: "aapl",
  companyName: "Apple Inc.",
  exchange: "NASDAQ",
  securityType: "Common Stock",
  secIdentityResolved: true,
  secCik: "0000320193",
  secFacts,
  companyMarket: {
    providerName: null,
    providerConfigured: false,
    fetchedAt: null,
    symbol: "AAPL",
    bars: [],
  },
  benchmarkMarket: {
    providerName: null,
    providerConfigured: false,
    fetchedAt: null,
    symbol: "SPY",
    bars: [],
  },
  benchmarkSymbol: "SPY",
  riskEvidence: {
    verified: false,
    checkedAt: null,
    source: null,
    flags: [],
  },
  calculatedAt: "2026-08-09T22:05:00Z",
} as const;

test("evaluation returns a public-safe unrated payload when evidence assembly is incomplete", () => {
  const evaluation = evaluateProductionRating(incompleteSource);

  assert.equal(evaluation.ready, false);
  assert.equal(evaluation.result.symbol, "AAPL");
  assert.equal(evaluation.result.eligible, false);
  assert.equal(evaluation.result.score, null);
  assert.equal(evaluation.result.tier, null);
  assert.equal(evaluation.result.summary, "Not Yet Rated");
  assert.equal(evaluation.result.eligibilityCode, "incomplete_evidence");
  assert.equal(evaluation.result.components.length, 0);
  assert.equal(evaluation.result.evidenceInputs.length, 0);

  if (evaluation.result.eligible) return;
  const missing = evaluation.result.reasons[0]?.missingEvidence ?? [];
  assert.ok(missing.includes("verified comparable annual financial history"));
  assert.ok(missing.includes("verified current risk evidence"));
  assert.ok(missing.includes("licensed market-data provider"));
});
