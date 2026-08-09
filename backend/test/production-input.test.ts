// TS: 2026-08-09 16:58 ET

import assert from "node:assert/strict";
import test from "node:test";
import { assembleProductionRatingInput } from "../src/ratings/production-input.js";

const incompleteSource = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  exchange: "NASDAQ",
  securityType: "Common Stock",
  secIdentityResolved: true,
  secCik: "0000320193",
  secFacts: { cik: "0000320193", entityName: "Apple Inc.", facts: {}, factHistory: undefined },
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
  riskEvidence: { verified: false, checkedAt: null, source: null, flags: [] },
  calculatedAt: "2026-08-09T20:58:00Z",
} as const;

test("production input assembly fails closed when any evidence family is missing", () => {
  const result = assembleProductionRatingInput(incompleteSource);
  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.equal(result.status, "Data Incomplete / Not Yet Rated");
  assert.ok(result.missingEvidence.includes("verified comparable annual financial history"));
  assert.ok(result.missingEvidence.includes("verified current risk evidence"));
  assert.ok(result.missingEvidence.includes("licensed market-data provider"));
  assert.ok(result.missingEvidence.some((item) => item.startsWith("benchmark ")));
});

test("risk provenance cannot be replaced by an unverified boolean claim", () => {
  const result = assembleProductionRatingInput({
    ...incompleteSource,
    riskEvidence: {
      verified: true,
      checkedAt: "2026-08-09T20:57:00Z",
      source: null,
      flags: [],
    },
  });
  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.ok(result.missingEvidence.includes("verified current risk evidence"));
});
