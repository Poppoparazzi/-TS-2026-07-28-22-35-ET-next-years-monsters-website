// TS: 2026-08-10 07:21 ET

import assert from "node:assert/strict";
import test from "node:test";
import { evaluatePublicRatingReadiness } from "../src/ratings/public-rating-readiness.js";

const now = new Date("2026-08-10T11:20:00.000Z");

const quote = {
  symbol: "NVDA",
  companyName: "NVIDIA Corporation",
  exchange: "NASDAQ",
  currency: "USD",
  price: 100,
  change: 1,
  percentChange: 1,
  volume: 1000,
  marketSession: "regular" as const,
  freshness: "near-live" as const,
  provider: "test-provider",
  providerTimestamp: "2026-08-10T11:15:00.000Z",
  retrievedAt: "2026-08-10T11:16:00.000Z",
  feedDisclosure: "test",
};

const secCompany = {
  ticker: "NVDA",
  cik: 1045810,
  cikPadded: "0001045810",
  companyName: "NVIDIA CORP",
  exchange: "Nasdaq",
  sourceUrl: "https://www.sec.gov/Archives/edgar/data/1045810/",
};

const secFacts = {
  ticker: "NVDA",
  cik: 1045810,
  companyName: "NVIDIA CORP",
  retrievedAt: "2026-08-10T11:10:00.000Z",
  facts: {
    Revenue: {
      key: "Revenue",
      taxonomy: "us-gaap",
      tag: "RevenueFromContractWithCustomerExcludingAssessedTax",
      label: "Revenue",
      description: "Revenue",
      unit: "USD",
      value: 1,
      form: "10-K",
      fiscalYear: 2026,
      fiscalPeriod: "FY",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      filed: "2026-02-01",
      accessionNumber: "0000000000-00-000001",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/1045810/example.htm",
    },
  },
  sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0001045810.json",
  disclosure: "test",
};

test("fails closed when risk evidence and versioned calculation are absent", () => {
  const result = evaluatePublicRatingReadiness({
    symbol: "nvda",
    quote,
    secCompany,
    secFacts,
    now,
  });

  assert.equal(result.symbol, "NVDA");
  assert.equal(result.ready, false);
  assert.equal(result.status, "not_yet_rated");
  assert.equal(result.score, null);
  assert.equal(result.modelVersion, null);
  assert.equal(result.gates.secIdentity.ready, true);
  assert.equal(result.gates.marketQuote.ready, true);
  assert.equal(result.gates.quoteFreshness.ready, true);
  assert.equal(result.gates.financialEvidence.ready, true);
  assert.equal(result.gates.riskEvidence.ready, false);
  assert.equal(result.gates.versionedCalculation.ready, false);
});

test("rejects stale provider freshness even when timestamps are recent", () => {
  const result = evaluatePublicRatingReadiness({
    symbol: "NVDA",
    quote: { ...quote, freshness: "stale" },
    secCompany,
    secFacts,
    riskEvidence: {
      symbol: "NVDA",
      verified: true,
      source: "test-risk-source",
      retrievedAt: "2026-08-10T11:10:00.000Z",
    },
    calculation: {
      symbol: "NVDA",
      score: 88,
      modelVersion: "nym-rating-v1.0.0",
      calculatedAt: "2026-08-10T11:18:00.000Z",
    },
    now,
  });

  assert.equal(result.ready, false);
  assert.equal(result.gates.quoteFreshness.ready, false);
  assert.equal(result.score, null);
});

test("returns a score only when every explicit gate passes", () => {
  const result = evaluatePublicRatingReadiness({
    symbol: "NVDA",
    quote,
    secCompany,
    secFacts,
    riskEvidence: {
      symbol: "NVDA",
      verified: true,
      source: "verified-risk-feed-v1",
      retrievedAt: "2026-08-10T11:10:00.000Z",
    },
    calculation: {
      symbol: "NVDA",
      score: 88,
      modelVersion: "nym-rating-v1.0.0",
      calculatedAt: "2026-08-10T11:18:00.000Z",
    },
    now,
  });

  assert.equal(result.ready, true);
  assert.equal(result.status, "ready");
  assert.equal(result.score, 88);
  assert.equal(result.modelVersion, "nym-rating-v1.0.0");
});

test("rejects SEC identity mismatches between company and facts", () => {
  const result = evaluatePublicRatingReadiness({
    symbol: "NVDA",
    quote,
    secCompany,
    secFacts: { ...secFacts, cik: 9999999 },
    now,
  });

  assert.equal(result.ready, false);
  assert.equal(result.gates.financialEvidence.ready, false);
});
