// TS: 2026-08-10 08:14 UTC

import assert from "node:assert/strict";
import test from "node:test";
import type { SecCompanyFactsSummary } from "../src/sec/types.js";
import { assembleProductionRatingInput } from "../src/ratings/production-input.js";

const secFacts: SecCompanyFactsSummary = {
  cik: "0000320193",
  companyName: "Apple Inc.",
  retrievedAt: "2026-08-09T20:55:00Z",
  facts: {},
  sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
  disclosure: "SEC company facts",
};

const incompleteSource = {
  symbol: "AAPL",
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

test("stale SEC company facts cannot qualify as current financial evidence", () => {
  const result = assembleProductionRatingInput({
    ...incompleteSource,
    secFacts: {
      ...secFacts,
      retrievedAt: "2026-07-20T20:55:00Z",
    },
  });

  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.ok(result.missingEvidence.includes("fresh verified SEC financial evidence"));
});

test("SEC financial evidence requires data.sec.gov source provenance", () => {
  const result = assembleProductionRatingInput({
    ...incompleteSource,
    secFacts: {
      ...secFacts,
      sourceUrl: "https://example.com/companyfacts.json",
    },
  });

  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.ok(result.missingEvidence.includes("verified SEC financial source provenance"));
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

test("stale company and benchmark market evidence fail closed before calculation", () => {
  const result = assembleProductionRatingInput({
    ...incompleteSource,
    companyMarket: {
      providerName: "licensed-test-provider",
      providerConfigured: true,
      fetchedAt: "2026-07-20T21:00:00Z",
      symbol: "AAPL",
      bars: [{ date: "2026-07-20", close: 200, volume: 1_000_000 }],
    },
    benchmarkMarket: {
      providerName: "licensed-test-provider",
      providerConfigured: true,
      fetchedAt: "2026-07-20T21:00:00Z",
      symbol: "SPY",
      bars: [{ date: "2026-07-20", close: 600, volume: 10_000_000 }],
    },
    riskEvidence: {
      verified: true,
      checkedAt: "2026-08-09T20:57:00Z",
      source: "verified-test-risk-source",
      flags: [],
    },
  });

  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.ok(result.missingEvidence.includes("fresh company market evidence"));
  assert.ok(result.missingEvidence.includes("fresh benchmark market evidence"));
});

test("stale risk evidence fails closed even when provenance is present", () => {
  const result = assembleProductionRatingInput({
    ...incompleteSource,
    riskEvidence: {
      verified: true,
      checkedAt: "2026-07-20T20:57:00Z",
      source: "verified-test-risk-source",
      flags: ["example-source-flag"],
    },
  });

  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.ok(result.missingEvidence.includes("fresh verified risk evidence"));
});

test("market fetch timestamps cannot predate the observations they claim to contain", () => {
  const result = assembleProductionRatingInput({
    ...incompleteSource,
    companyMarket: {
      providerName: "licensed-test-provider",
      providerConfigured: true,
      fetchedAt: "2026-08-08T20:00:00Z",
      symbol: "AAPL",
      bars: [{ date: "2026-08-09", close: 200, volume: 1_000_000 }],
    },
    benchmarkMarket: {
      providerName: "licensed-test-provider",
      providerConfigured: true,
      fetchedAt: "2026-08-08T20:00:00Z",
      symbol: "SPY",
      bars: [{ date: "2026-08-09", close: 600, volume: 10_000_000 }],
    },
  });

  assert.equal(result.ready, false);
  if (result.ready) return;
  assert.ok(result.missingEvidence.includes("fresh company market evidence"));
  assert.ok(result.missingEvidence.includes("fresh benchmark market evidence"));
});
