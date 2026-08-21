// TS: 2026-08-21 17:08 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { calculateMonsterRatingV1, MONSTER_RATING_ENGINE_VERSION } from "../src/ratings/engine-v1.js";
import type { FinancialPeriodEvidence, MarketBarEvidence, ProductionRatingInput } from "../src/ratings/types.js";

function financialPeriod(year: number, revenue: number, netIncome: number): FinancialPeriodEvidence {
  return Object.freeze({
    periodEnd: `${year}-12-31`,
    fiscalYear: year,
    fiscalPeriod: "FY",
    form: "10-K",
    filedAt: `${year + 1}-02-15`,
    revenue,
    grossProfit: revenue * 0.55,
    operatingIncome: revenue * 0.22,
    netIncome,
    dilutedEps: netIncome / 10,
    assets: revenue * 1.4,
    liabilities: revenue * 0.55,
    shareholdersEquity: revenue * 0.85,
    cash: revenue * 0.2,
    operatingCashFlow: revenue * 0.25,
    sourceUrl: `https://www.sec.gov/Archives/edgar/data/1/${year}.htm`,
  });
}

function marketBars(startPrice: number, dailyGrowth: number): readonly MarketBarEvidence[] {
  const end = new Date("2026-08-21T00:00:00.000Z");
  return Object.freeze(Array.from({ length: 300 }, (_, index) => {
    const date = new Date(end.getTime() - (299 - index) * 24 * 60 * 60 * 1_000);
    return Object.freeze({
      date: date.toISOString().slice(0, 10),
      close: startPrice * (1 + dailyGrowth) ** index,
      volume: 2_000_000 + index * 2_000,
    });
  }));
}

function productionInput(): ProductionRatingInput {
  return Object.freeze({
    symbol: "TEST",
    companyName: "Test Growth Company",
    exchange: "NASDAQ",
    securityType: "Common Stock",
    secIdentityResolved: true,
    secCik: "0000000001",
    financialPeriods: Object.freeze([
      financialPeriod(2023, 100, 8),
      financialPeriod(2024, 130, 13),
      financialPeriod(2025, 180, 25),
    ]),
    marketBars: marketBars(20, 0.0024),
    benchmarkSymbol: "SPY",
    benchmarkBars: marketBars(400, 0.0005),
    marketProviderName: "test-market",
    marketProviderConfigured: true,
    calculatedAt: "2026-08-21T17:08:00.000Z",
  });
}

test("Monster Rating v1 returns a repeatable explainable 0-100 score", () => {
  const first = calculateMonsterRatingV1(productionInput());
  const second = calculateMonsterRatingV1(productionInput());

  assert.deepEqual(second, first);
  assert.equal(first.engineVersion, MONSTER_RATING_ENGINE_VERSION);
  assert.equal(first.eligible, true);
  assert.ok(first.score >= 0 && first.score <= 100);
  assert.equal(first.components.length, 8);
  assert.equal(
    Math.round(first.components.reduce((total, component) => total + component.weight, 0) * 100),
    100,
  );
  assert.ok(first.evidenceInputs.some((item) => item.sourceType === "company-fact"));
  assert.ok(first.evidenceInputs.some((item) => item.sourceType === "market-data"));
  assert.match(first.summary, /not a probability or recommendation/i);
});

test("Monster Rating v1 stays honestly unrated without a market provider", () => {
  const result = calculateMonsterRatingV1({
    ...productionInput(),
    marketProviderConfigured: false,
    marketProviderName: null,
  });

  assert.equal(result.eligible, false);
  assert.equal(result.score, null);
  assert.equal(result.eligibilityCode, "provider_not_connected");
  assert.equal(result.summary, "Provider Not Connected");
});

test("Monster Rating v1 requires comparable annual SEC history", () => {
  const result = calculateMonsterRatingV1({
    ...productionInput(),
    financialPeriods: Object.freeze([financialPeriod(2025, 180, 25)]),
  });

  assert.equal(result.eligible, false);
  assert.equal(result.eligibilityCode, "insufficient_financial_history");
  assert.match(result.reasons[0]?.message ?? "", /two comparable annual SEC revenue periods/i);
});
