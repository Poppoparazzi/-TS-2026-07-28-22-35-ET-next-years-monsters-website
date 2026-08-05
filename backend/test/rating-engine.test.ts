// TS: 2026-08-05 07:47 ET

import assert from "node:assert/strict";
import test from "node:test";
import { calculateProductionMonsterRating } from "../src/ratings/engine.js";
import {
  MONSTER_RATING_ENGINE_VERSION,
  RATING_COMPONENT_SPECIFICATIONS,
  ratingTier,
} from "../src/ratings/spec-v1.js";
import type {
  FinancialPeriodEvidence,
  MarketBarEvidence,
  ProductionRatingInput,
} from "../src/ratings/types.js";

function marketBars(
  count: number,
  options: {
    readonly startPrice: number;
    readonly dailyChange: number;
    readonly volume: number;
    readonly endDate?: string;
  },
): readonly MarketBarEvidence[] {
  const end = new Date(`${options.endDate ?? "2026-08-04"}T00:00:00.000Z`);
  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const date = new Date(end);
      date.setUTCDate(end.getUTCDate() - (count - 1 - index));
      return Object.freeze({
        date: date.toISOString().slice(0, 10),
        close: Math.max(0.01, options.startPrice + options.dailyChange * index),
        volume: options.volume + index * 1_000,
      });
    }),
  );
}

const strongFinancials: readonly FinancialPeriodEvidence[] = Object.freeze([
  {
    periodEnd: "2025-12-31",
    fiscalYear: 2025,
    fiscalPeriod: "FY",
    form: "10-K",
    filedAt: "2026-02-15",
    revenue: 1_500_000_000,
    grossProfit: 900_000_000,
    operatingIncome: 330_000_000,
    netIncome: 240_000_000,
    dilutedEps: 4.8,
    assets: 2_000_000_000,
    liabilities: 700_000_000,
    shareholdersEquity: 1_300_000_000,
    cash: 350_000_000,
    operatingCashFlow: 310_000_000,
    sourceUrl: "https://www.sec.gov/example/2025",
  },
  {
    periodEnd: "2024-12-31",
    fiscalYear: 2024,
    fiscalPeriod: "FY",
    form: "10-K",
    filedAt: "2025-02-15",
    revenue: 1_150_000_000,
    grossProfit: 650_000_000,
    operatingIncome: 220_000_000,
    netIncome: 150_000_000,
    dilutedEps: 3.1,
    assets: 1_750_000_000,
    liabilities: 720_000_000,
    shareholdersEquity: 1_030_000_000,
    cash: 260_000_000,
    operatingCashFlow: 210_000_000,
    sourceUrl: "https://www.sec.gov/example/2024",
  },
  {
    periodEnd: "2023-12-31",
    fiscalYear: 2023,
    fiscalPeriod: "FY",
    form: "10-K",
    filedAt: "2024-02-15",
    revenue: 950_000_000,
    grossProfit: 500_000_000,
    operatingIncome: 160_000_000,
    netIncome: 105_000_000,
    dilutedEps: 2.2,
    assets: 1_500_000_000,
    liabilities: 750_000_000,
    shareholdersEquity: 750_000_000,
    cash: 190_000_000,
    operatingCashFlow: 155_000_000,
    sourceUrl: "https://www.sec.gov/example/2023",
  },
]);

function eligibleInput(overrides: Partial<ProductionRatingInput> = {}): ProductionRatingInput {
  return Object.freeze({
    symbol: "TEST",
    companyName: "Test Growth Corporation",
    exchange: "NASDAQ",
    securityType: "Common Stock",
    secIdentityResolved: true,
    secCik: "0001234567",
    financialPeriods: strongFinancials,
    marketBars: marketBars(260, {
      startPrice: 30,
      dailyChange: 0.22,
      volume: 2_000_000,
    }),
    benchmarkSymbol: "SPY",
    benchmarkBars: marketBars(260, {
      startPrice: 400,
      dailyChange: 0.18,
      volume: 50_000_000,
    }),
    marketProviderName: "test-licensed-provider",
    marketProviderConfigured: true,
    calculatedAt: "2026-08-05T11:00:00.000Z",
    ...overrides,
  });
}

test("production rating is deterministic, bounded, versioned, and reconciles components", () => {
  const first = calculateProductionMonsterRating(eligibleInput());
  const second = calculateProductionMonsterRating(eligibleInput());

  assert.deepEqual(second, first);
  assert.equal(first.eligible, true);
  if (!first.eligible) assert.fail("Expected eligible production rating.");
  assert.equal(first.engineVersion, MONSTER_RATING_ENGINE_VERSION);
  assert.equal(first.components.length, RATING_COMPONENT_SPECIFICATIONS.length);
  assert.ok(first.score >= 1 && first.score <= 100);
  assert.equal(first.tier, ratingTier(first.score));
  assert.ok(first.dataCompletenessScore >= 90);
  assert.ok(first.evidenceInputs.length > first.components.length);

  const weightTotal = first.components.reduce((sum, component) => sum + component.weight, 0);
  const weightedTotal = first.components.reduce(
    (sum, component) => sum + component.weightedScore,
    0,
  );
  assert.ok(Math.abs(weightTotal - 1) < 0.000_001);
  assert.ok(Math.abs(weightedTotal - first.score) <= 1);
  assert.ok(first.positiveDrivers.length > 0);
});

test("production tier boundaries are explicit and have no gaps", () => {
  assert.equal(ratingTier(100), "Platinum");
  assert.equal(ratingTier(92), "Platinum");
  assert.equal(ratingTier(91.99), "Gold");
  assert.equal(ratingTier(85), "Gold");
  assert.equal(ratingTier(75), "Silver");
  assert.equal(ratingTier(65), "Bronze");
  assert.equal(ratingTier(50), "Goblin");
  assert.equal(ratingTier(1), "Cemetery Risk");
});

test("unresolved SEC identity never receives a score", () => {
  const result = calculateProductionMonsterRating(
    eligibleInput({ secIdentityResolved: false, secCik: null }),
  );

  assert.equal(result.eligible, false);
  assert.equal(result.score, null);
  assert.equal(result.summary, "Unresolved SEC Identity");
  assert.equal(result.eligibilityCode, "unresolved_sec_identity");
  if (result.eligible) assert.fail("Expected unresolved result.");
  assert.ok(result.reasons.some((reason) => reason.code === "unresolved_sec_identity"));
});

test("missing licensed market provider returns Provider Not Connected without invented output", () => {
  const result = calculateProductionMonsterRating(
    eligibleInput({ marketProviderConfigured: false, marketProviderName: null }),
  );

  assert.equal(result.eligible, false);
  assert.equal(result.score, null);
  assert.equal(result.tier, null);
  assert.equal(result.summary, "Provider Not Connected");
  if (result.eligible) assert.fail("Expected provider failure result.");
  assert.ok(result.reasons.some((reason) => reason.code === "provider_not_connected"));
});

test("insufficient or stale evidence returns exact machine-readable reasons", () => {
  const result = calculateProductionMonsterRating(
    eligibleInput({
      financialPeriods: strongFinancials.slice(0, 1),
      marketBars: marketBars(40, {
        startPrice: 30,
        dailyChange: 0.1,
        volume: 1_000_000,
        endDate: "2026-06-01",
      }),
      benchmarkBars: marketBars(40, {
        startPrice: 400,
        dailyChange: 0.1,
        volume: 50_000_000,
        endDate: "2026-06-01",
      }),
    }),
  );

  assert.equal(result.eligible, false);
  if (result.eligible) assert.fail("Expected incomplete result.");
  const codes = new Set(result.reasons.map((reason) => reason.code));
  assert.equal(codes.has("insufficient_financial_history"), true);
  assert.equal(codes.has("insufficient_market_history"), true);
  assert.equal(codes.has("stale_market_data"), true);
  assert.equal(codes.has("incomplete_evidence"), true);
});

test("unsupported funds and insufficient liquidity remain unrated", () => {
  const result = calculateProductionMonsterRating(
    eligibleInput({
      securityType: "Exchange Traded Fund",
      marketBars: marketBars(260, {
        startPrice: 0.01,
        dailyChange: 0,
        volume: 1_000,
      }),
    }),
  );

  assert.equal(result.eligible, false);
  if (result.eligible) assert.fail("Expected unsupported security result.");
  const codes = new Set(result.reasons.map((reason) => reason.code));
  assert.equal(codes.has("unsupported_security_type"), true);
  assert.equal(codes.has("insufficient_liquidity"), true);
});

test("severely deteriorating but eligible evidence remains within rating bounds", () => {
  const weakPeriods: readonly FinancialPeriodEvidence[] = Object.freeze(
    strongFinancials.map((period, index) => ({
      ...period,
      revenue: 900_000_000 - index * -250_000_000,
      grossProfit: 70_000_000,
      operatingIncome: -180_000_000,
      netIncome: -240_000_000,
      dilutedEps: -4 - index,
      assets: 1_000_000_000,
      liabilities: 950_000_000,
      shareholdersEquity: 50_000_000,
      cash: 5_000_000,
      operatingCashFlow: -150_000_000,
    })),
  );
  const result = calculateProductionMonsterRating(
    eligibleInput({
      financialPeriods: weakPeriods,
      marketBars: marketBars(260, {
        startPrice: 100,
        dailyChange: -0.2,
        volume: 2_000_000,
      }),
    }),
  );

  assert.equal(result.eligible, true);
  if (!result.eligible) assert.fail("Expected eligible weak rating.");
  assert.ok(result.score >= 1 && result.score <= 100);
  assert.ok(result.negativeDrivers.length > 0);
  assert.match(result.risks, /pressure/i);
});
