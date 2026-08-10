// TS: 2026-08-09 13:08 ET

import assert from "node:assert/strict";
import test from "node:test";
import { calculateProductionMonsterRating } from "../src/ratings/engine.js";
import { MONSTER_RATING_ENGINE_VERSION, RATING_COMPONENT_SPECIFICATIONS, ratingTier } from "../src/ratings/spec-v1.js";
import type { FinancialPeriodEvidence, MarketBarEvidence, ProductionRatingInput } from "../src/ratings/types.js";

function marketBars(count: number, startPrice: number, dailyChange: number, volume: number, endDate = "2026-08-04"): readonly MarketBarEvidence[] {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (count - 1 - index));
    return Object.freeze({
      date: date.toISOString().slice(0, 10),
      close: Math.max(0.01, startPrice + dailyChange * index),
      volume: volume + index * 1_000,
    });
  }));
}

const financials: readonly FinancialPeriodEvidence[] = Object.freeze([
  Object.freeze({
    periodEnd: "2025-12-31", fiscalYear: 2025, fiscalPeriod: "FY", form: "10-K", filedAt: "2026-02-15",
    revenue: 1_500_000_000, grossProfit: 900_000_000, operatingIncome: 330_000_000, netIncome: 240_000_000,
    dilutedEps: 4.8, assets: 2_000_000_000, liabilities: 700_000_000, shareholdersEquity: 1_300_000_000,
    cash: 350_000_000, operatingCashFlow: 310_000_000, sourceUrl: "https://www.sec.gov/example/2025",
  }),
  Object.freeze({
    periodEnd: "2024-12-31", fiscalYear: 2024, fiscalPeriod: "FY", form: "10-K", filedAt: "2025-02-15",
    revenue: 1_150_000_000, grossProfit: 650_000_000, operatingIncome: 220_000_000, netIncome: 150_000_000,
    dilutedEps: 3.1, assets: 1_750_000_000, liabilities: 720_000_000, shareholdersEquity: 1_030_000_000,
    cash: 260_000_000, operatingCashFlow: 210_000_000, sourceUrl: "https://www.sec.gov/example/2024",
  }),
  Object.freeze({
    periodEnd: "2023-12-31", fiscalYear: 2023, fiscalPeriod: "FY", form: "10-K", filedAt: "2024-02-15",
    revenue: 950_000_000, grossProfit: 500_000_000, operatingIncome: 160_000_000, netIncome: 105_000_000,
    dilutedEps: 2.2, assets: 1_500_000_000, liabilities: 750_000_000, shareholdersEquity: 750_000_000,
    cash: 190_000_000, operatingCashFlow: 155_000_000, sourceUrl: "https://www.sec.gov/example/2023",
  }),
]);

function input(overrides: Partial<ProductionRatingInput> = {}): ProductionRatingInput {
  return Object.freeze({
    symbol: "TEST",
    companyName: "Test Growth Corporation",
    exchange: "NASDAQ",
    securityType: "Common Stock",
    secIdentityResolved: true,
    secCik: "0001234567",
    financialPeriods: financials,
    marketBars: marketBars(260, 30, 0.22, 2_000_000),
    benchmarkSymbol: "SPY",
    benchmarkBars: marketBars(260, 400, 0.18, 50_000_000),
    marketProviderName: "test-licensed-provider",
    marketProviderConfigured: true,
    calculatedAt: "2026-08-05T11:00:00.000Z",
    ...overrides,
  });
}

test("eligible rating is deterministic, versioned, bounded, and fully reconciled", () => {
  const first = calculateProductionMonsterRating(input());
  const second = calculateProductionMonsterRating(input());
  assert.deepEqual(second, first);
  assert.equal(first.eligible, true);
  if (!first.eligible) assert.fail("Expected eligible rating");
  assert.equal(first.engineVersion, MONSTER_RATING_ENGINE_VERSION);
  assert.equal(first.components.length, RATING_COMPONENT_SPECIFICATIONS.length);
  assert.ok(first.score >= 1 && first.score <= 100);
  assert.equal(first.tier, ratingTier(first.score));
  assert.ok(first.dataCompletenessScore >= 90);
  const weightTotal = first.components.reduce((sum, component) => sum + component.weight, 0);
  assert.ok(Math.abs(weightTotal - 1) < 0.000_001);
});

test("score 92 remains an unresolved tier boundary", () => {
  assert.equal(ratingTier(93), "Platinum");
  assert.equal(ratingTier(92), "Tier Boundary Unresolved");
  assert.equal(ratingTier(91), "Gold");
});

test("unresolved SEC identity never receives a numeric score", () => {
  const result = calculateProductionMonsterRating(input({ secIdentityResolved: false, secCik: null }));
  assert.equal(result.eligible, false);
  assert.equal(result.score, null);
  assert.equal(result.summary, "Unresolved SEC Identity");
  assert.equal(result.eligibilityCode, "unresolved_sec_identity");
});

test("missing market provider remains Provider Not Connected", () => {
  const result = calculateProductionMonsterRating(input({ marketProviderConfigured: false, marketProviderName: null }));
  assert.equal(result.eligible, false);
  assert.equal(result.score, null);
  assert.equal(result.summary, "Provider Not Connected");
  assert.equal(result.eligibilityCode, "provider_not_connected");
});

test("stale and insufficient evidence stays unrated with machine-readable reasons", () => {
  const result = calculateProductionMonsterRating(input({
    financialPeriods: financials.slice(0, 1),
    marketBars: marketBars(40, 30, 0.1, 1_000_000, "2026-06-01"),
    benchmarkBars: marketBars(40, 400, 0.1, 50_000_000, "2026-06-01"),
  }));
  assert.equal(result.eligible, false);
  if (result.eligible) assert.fail("Expected ineligible rating");
  const codes = new Set(result.reasons.map((reason) => reason.code));
  assert.equal(codes.has("insufficient_financial_history"), true);
  assert.equal(codes.has("insufficient_market_history"), true);
  assert.equal(codes.has("stale_market_data"), true);
  assert.equal(codes.has("incomplete_evidence"), true);
});

test("unsupported securities and insufficient liquidity remain unrated", () => {
  const result = calculateProductionMonsterRating(input({
    securityType: "Exchange Traded Fund",
    marketBars: marketBars(260, 0.01, 0, 1_000),
  }));
  assert.equal(result.eligible, false);
  if (result.eligible) assert.fail("Expected ineligible rating");
  const codes = new Set(result.reasons.map((reason) => reason.code));
  assert.equal(codes.has("unsupported_security_type"), true);
  assert.equal(codes.has("insufficient_liquidity"), true);
});
