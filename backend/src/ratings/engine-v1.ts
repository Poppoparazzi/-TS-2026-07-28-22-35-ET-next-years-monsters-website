// TS: 2026-08-21 17:08 UTC

import type {
  EligibleProductionRating,
  FinancialPeriodEvidence,
  IneligibleProductionRating,
  MarketBarEvidence,
  ProductionRatingInput,
  ProductionRatingResult,
  RatingComponentKey,
  RatingComponentResult,
  RatingEvidenceValue,
  RatingTier,
} from "./types.js";

export const MONSTER_RATING_ENGINE_VERSION = "nym-current-stock-rating-v1.0.0";

const COMPONENT_WEIGHTS = Object.freeze({
  growth_acceleration: 0.2,
  business_quality: 0.15,
  earnings_revenue_evidence: 0.1,
  risk_deterioration: 0.15,
  price_volume_leadership: 0.15,
  relative_strength: 0.15,
  liquidity_tradability: 0.05,
  data_freshness_completeness: 0.05,
} satisfies Readonly<Partial<Record<RatingComponentKey, number>>>);

function clamp(value: number, minimum = 0, maximum = 100): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function finite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function percentChange(current: number, prior: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

function daysBetween(later: string, earlier: string): number {
  return (Date.parse(later) - Date.parse(earlier)) / (24 * 60 * 60 * 1_000);
}

function annualPeriods(periods: readonly FinancialPeriodEvidence[]): readonly FinancialPeriodEvidence[] {
  const byYear = new Map<number, FinancialPeriodEvidence>();
  for (const period of periods) {
    if (period.fiscalYear === null || period.fiscalPeriod !== "FY") continue;
    const current = byYear.get(period.fiscalYear);
    if (!current || period.filedAt > current.filedAt) byYear.set(period.fiscalYear, period);
  }
  return [...byYear.values()].sort((left, right) => left.periodEnd.localeCompare(right.periodEnd));
}

function sortedBars(bars: readonly MarketBarEvidence[]): readonly MarketBarEvidence[] {
  return [...bars]
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(bar.volume) && bar.volume >= 0)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function trailingReturn(bars: readonly MarketBarEvidence[], sessions: number): number | null {
  if (bars.length <= sessions) return null;
  const latest = bars.at(-1)?.close;
  const prior = bars.at(-(sessions + 1))?.close;
  return finite(latest) && finite(prior) ? percentChange(latest, prior) : null;
}

function latestValue(periods: readonly FinancialPeriodEvidence[], key: keyof FinancialPeriodEvidence): number | null {
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    const value = periods[index]?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function evidence(
  key: string,
  label: string,
  value: number | string | boolean | null,
  unit: string | null,
  sourceType: RatingEvidenceValue["sourceType"],
  sourceTimestamp: string | null,
  sourceUrl: string | null,
): RatingEvidenceValue {
  return Object.freeze({ key, label, value, unit, sourceType, sourceTimestamp, sourceUrl });
}

function component(
  key: keyof typeof COMPONENT_WEIGHTS,
  label: string,
  score: number,
  explanation: string,
  componentEvidence: readonly RatingEvidenceValue[],
): RatingComponentResult {
  const normalizedScore = round(clamp(score));
  const weight = COMPONENT_WEIGHTS[key];
  const direction = normalizedScore >= 67 ? "positive" : normalizedScore < 40 ? "negative" : "neutral";
  return Object.freeze({
    key,
    label,
    score: normalizedScore,
    weight,
    weightedScore: round(normalizedScore * weight),
    direction,
    explanation,
    evidence: Object.freeze([...componentEvidence]),
  });
}

function tierForScore(score: number): RatingTier {
  if (score >= 90) return "Platinum";
  if (score >= 75) return "Gold";
  if (score >= 60) return "Silver";
  if (score >= 45) return "Bronze";
  if (score >= 30) return "Goblin";
  return "Cemetery Risk";
}

function ineligible(
  input: ProductionRatingInput,
  code: IneligibleProductionRating["eligibilityCode"],
  message: string,
  missingEvidence: readonly string[],
): IneligibleProductionRating {
  const summary = code === "unresolved_sec_identity"
    ? "Unresolved SEC Identity"
    : code === "provider_not_connected"
      ? "Provider Not Connected"
      : "Not Yet Rated";
  return Object.freeze({
    symbol: input.symbol,
    companyName: input.companyName,
    engineVersion: MONSTER_RATING_ENGINE_VERSION,
    calculatedAt: input.calculatedAt,
    dataAsOf: null,
    dataCompletenessScore: 0,
    evidenceInputs: Object.freeze([]),
    eligible: false,
    eligibilityCode: code,
    score: null,
    tier: null,
    confidence: "unavailable",
    components: Object.freeze([]),
    reasons: Object.freeze([{
      code,
      message,
      retryable: code !== "unsupported_security_type",
      missingEvidence: Object.freeze([...missingEvidence]),
    }]),
    summary,
  });
}

function marketTechnicalScore(bars: readonly MarketBarEvidence[]): {
  readonly score: number;
  readonly threeMonth: number;
  readonly sixMonth: number;
  readonly oneYear: number;
  readonly drawdown: number;
} | null {
  const threeMonth = trailingReturn(bars, 63);
  const sixMonth = trailingReturn(bars, 126);
  const oneYear = trailingReturn(bars, 252);
  if (threeMonth === null || sixMonth === null || oneYear === null) return null;
  const recent = bars.slice(-63);
  const high = Math.max(...recent.map((bar) => bar.close));
  const latest = bars.at(-1)?.close ?? 0;
  const drawdown = high > 0 ? latest / high - 1 : -1;

  const threeMonthPoints = threeMonth >= 0.4 ? 4 : threeMonth >= 0.15 ? 3 : threeMonth >= 0 ? 2 : threeMonth >= -0.15 ? 1 : 0;
  const sixMonthPoints = sixMonth >= 0.6 ? 3 : sixMonth >= 0.2 ? 2.5 : sixMonth >= 0 ? 2 : sixMonth >= -0.2 ? 1 : 0;
  const oneYearPoints = oneYear >= 0.8 ? 2 : oneYear >= 0.2 ? 1.5 : oneYear >= 0 ? 1 : 0;
  const highPoints = drawdown >= -0.15 ? 1 : drawdown >= -0.3 ? 0.5 : 0;
  return Object.freeze({
    score: (threeMonthPoints + sixMonthPoints + oneYearPoints + highPoints) * 10,
    threeMonth,
    sixMonth,
    oneYear,
    drawdown,
  });
}

function relativeStrengthScore(
  companyBars: readonly MarketBarEvidence[],
  benchmarkBars: readonly MarketBarEvidence[],
): { readonly score: number; readonly excessThreeMonth: number; readonly excessOneYear: number } | null {
  const companyThreeMonth = trailingReturn(companyBars, 63);
  const companyOneYear = trailingReturn(companyBars, 252);
  const benchmarkThreeMonth = trailingReturn(benchmarkBars, 63);
  const benchmarkOneYear = trailingReturn(benchmarkBars, 252);
  if (
    companyThreeMonth === null || companyOneYear === null ||
    benchmarkThreeMonth === null || benchmarkOneYear === null
  ) return null;
  const excessThreeMonth = companyThreeMonth - benchmarkThreeMonth;
  const excessOneYear = companyOneYear - benchmarkOneYear;
  const score = clamp(50 + excessThreeMonth * 110 + excessOneYear * 70);
  return Object.freeze({ score, excessThreeMonth, excessOneYear });
}

export function calculateMonsterRatingV1(input: ProductionRatingInput): ProductionRatingResult {
  const symbol = input.symbol.trim().toUpperCase();
  const normalizedInput = Object.freeze({ ...input, symbol });
  if (!input.secIdentityResolved || !input.secCik) {
    return ineligible(normalizedInput, "unresolved_sec_identity", "Official SEC identity is not resolved.", ["sec_identity"]);
  }
  if (!input.marketProviderConfigured || !input.marketProviderName) {
    return ineligible(normalizedInput, "provider_not_connected", "Licensed historical market data is not connected.", ["market_provider"]);
  }
  if (input.securityType && !/common stock|ordinary shares/i.test(input.securityType)) {
    return ineligible(normalizedInput, "unsupported_security_type", "The security type is outside the initial common-stock rating policy.", ["supported_security_type"]);
  }

  const financials = annualPeriods(input.financialPeriods);
  const companyBars = sortedBars(input.marketBars);
  const benchmarkBars = sortedBars(input.benchmarkBars);
  if (financials.length < 2 || financials.filter((period) => finite(period.revenue)).length < 2) {
    return ineligible(normalizedInput, "insufficient_financial_history", "At least two comparable annual SEC revenue periods are required.", ["two_annual_revenue_periods"]);
  }
  if (companyBars.length < 253 || benchmarkBars.length < 253) {
    return ineligible(normalizedInput, "insufficient_market_history", "At least 253 daily company and benchmark bars are required.", ["company_daily_bars", "benchmark_daily_bars"]);
  }

  const latestMarketDate = companyBars.at(-1)?.date ?? "";
  if (!latestMarketDate || daysBetween(input.calculatedAt, latestMarketDate) > 7) {
    return ineligible(normalizedInput, "stale_market_data", "The latest daily market bar is more than seven calendar days old.", ["current_daily_bar"]);
  }

  const revenuePeriods = financials.filter((period) => finite(period.revenue));
  const currentFinancial = revenuePeriods.at(-1)!;
  const priorFinancial = revenuePeriods.at(-2)!;
  const earlierFinancial = revenuePeriods.at(-3) ?? null;
  const revenueGrowth = percentChange(currentFinancial.revenue!, priorFinancial.revenue!) ?? 0;
  const priorRevenueGrowth = earlierFinancial
    ? percentChange(priorFinancial.revenue!, earlierFinancial.revenue!)
    : null;
  const acceleration = priorRevenueGrowth === null ? 0 : revenueGrowth - priorRevenueGrowth;
  const growthScore = clamp(50 + revenueGrowth * 120 + acceleration * 75);

  const latestRevenue = latestValue(financials, "revenue") ?? 0;
  const latestGrossProfit = latestValue(financials, "grossProfit");
  const latestOperatingIncome = latestValue(financials, "operatingIncome");
  const latestNetIncome = latestValue(financials, "netIncome");
  const latestOperatingCashFlow = latestValue(financials, "operatingCashFlow");
  const grossMargin = latestRevenue > 0 && finite(latestGrossProfit) ? latestGrossProfit / latestRevenue : null;
  const operatingMargin = latestRevenue > 0 && finite(latestOperatingIncome) ? latestOperatingIncome / latestRevenue : null;
  const netMargin = latestRevenue > 0 && finite(latestNetIncome) ? latestNetIncome / latestRevenue : null;
  const cashFlowMargin = latestRevenue > 0 && finite(latestOperatingCashFlow) ? latestOperatingCashFlow / latestRevenue : null;
  const qualityInputs = [
    grossMargin === null ? null : clamp(grossMargin * 140),
    operatingMargin === null ? null : clamp(40 + operatingMargin * 180),
    netMargin === null ? null : clamp(40 + netMargin * 180),
    cashFlowMargin === null ? null : clamp(40 + cashFlowMargin * 180),
  ].filter(finite);
  const qualityScore = qualityInputs.length > 0
    ? qualityInputs.reduce((total, value) => total + value, 0) / qualityInputs.length
    : 0;

  const priorNetIncome = priorFinancial.netIncome;
  const netIncomeTrend = finite(latestNetIncome) && finite(priorNetIncome)
    ? percentChange(latestNetIncome, priorNetIncome)
    : null;
  const earningsScore = clamp(50 + revenueGrowth * 70 + (netIncomeTrend ?? 0) * 35);

  const latestAssets = latestValue(financials, "assets");
  const latestLiabilities = latestValue(financials, "liabilities");
  const latestCash = latestValue(financials, "cash");
  const liabilityRatio = finite(latestAssets) && latestAssets > 0 && finite(latestLiabilities)
    ? latestLiabilities / latestAssets
    : null;
  const cashRatio = finite(latestAssets) && latestAssets > 0 && finite(latestCash)
    ? latestCash / latestAssets
    : null;
  const riskInputs = [
    liabilityRatio === null ? null : clamp(110 - liabilityRatio * 120),
    cashRatio === null ? null : clamp(cashRatio * 300),
    finite(latestOperatingCashFlow) ? (latestOperatingCashFlow > 0 ? 80 : 10) : null,
    finite(latestNetIncome) ? (latestNetIncome > 0 ? 80 : 10) : null,
  ].filter(finite);
  const riskScore = riskInputs.length > 0
    ? riskInputs.reduce((total, value) => total + value, 0) / riskInputs.length
    : 0;

  const technical = marketTechnicalScore(companyBars)!;
  const relativeStrength = relativeStrengthScore(companyBars, benchmarkBars)!;
  const recentBars = companyBars.slice(-20);
  const comparisonBars = companyBars.slice(-80, -20);
  const recentAverageVolume = recentBars.reduce((total, bar) => total + bar.volume, 0) / recentBars.length;
  const priorAverageVolume = comparisonBars.reduce((total, bar) => total + bar.volume, 0) / comparisonBars.length;
  const upVolume = recentBars.reduce((total, bar, index) => {
    const prior = companyBars.at(-(recentBars.length - index + 1));
    return total + (prior && bar.close > prior.close ? bar.volume : 0);
  }, 0);
  const totalVolume = recentBars.reduce((total, bar) => total + bar.volume, 0);
  const accumulationRatio = totalVolume > 0 ? upVolume / totalVolume : 0.5;
  const volumeExpansion = priorAverageVolume > 0 ? recentAverageVolume / priorAverageVolume : 1;
  const priceVolumeScore = clamp(technical.score * 0.7 + clamp(50 + (volumeExpansion - 1) * 35 + (accumulationRatio - 0.5) * 80) * 0.3);

  const latestClose = companyBars.at(-1)?.close ?? 0;
  const averageDollarVolume = recentAverageVolume * latestClose;
  const liquidityScore = clamp((Math.log10(Math.max(averageDollarVolume, 1)) - 6) / 3 * 100);
  if (averageDollarVolume < 1_000_000) {
    return ineligible(normalizedInput, "insufficient_liquidity", "Average daily dollar volume is below the initial $1 million tradability floor.", ["minimum_liquidity"]);
  }

  const latestFiledAt = financials.at(-1)?.filedAt ?? currentFinancial.filedAt;
  const marketAge = Math.max(daysBetween(input.calculatedAt, latestMarketDate), 0);
  const filingAge = Math.max(daysBetween(input.calculatedAt, latestFiledAt), 0);
  const freshnessScore = clamp(100 - Math.max(marketAge - 2, 0) * 8 - Math.max(filingAge - 120, 0) / 8);
  const secSource = currentFinancial.sourceUrl;
  const evidenceInputs = Object.freeze([
    evidence("revenue_growth", "Latest annual revenue growth", round(revenueGrowth * 100), "%", "company-fact", currentFinancial.filedAt, secSource),
    evidence("operating_margin", "Latest operating margin", operatingMargin === null ? null : round(operatingMargin * 100), "%", "company-fact", currentFinancial.filedAt, secSource),
    evidence("operating_cash_flow", "Latest operating cash flow", latestOperatingCashFlow, "USD", "company-fact", currentFinancial.filedAt, secSource),
    evidence("three_month_return", "Three-month price return", round(technical.threeMonth * 100), "%", "market-data", latestMarketDate, null),
    evidence("one_year_return", "One-year price return", round(technical.oneYear * 100), "%", "market-data", latestMarketDate, null),
    evidence("average_dollar_volume", "20-session average dollar volume", round(averageDollarVolume), "USD", "market-data", latestMarketDate, null),
  ]);

  const components = Object.freeze([
    component("growth_acceleration", "Growth acceleration", growthScore, `Annual revenue changed ${round(revenueGrowth * 100, 1)}%; acceleration versus the prior annual comparison was ${round(acceleration * 100, 1)} points.`, evidenceInputs.filter((item) => item.key === "revenue_growth")),
    component("business_quality", "Business quality", qualityScore, "Margins and operating cash flow are normalized from comparable SEC annual evidence.", evidenceInputs.filter((item) => ["operating_margin", "operating_cash_flow"].includes(item.key))),
    component("earnings_revenue_evidence", "Earnings and revenue evidence", earningsScore, "Revenue growth and net-income direction are scored together; missing profit evidence is not silently replaced.", evidenceInputs.filter((item) => item.sourceType === "company-fact")),
    component("risk_deterioration", "Financial risk resilience", riskScore, "Balance-sheet leverage, cash, operating cash flow, and profitability form the machine-readable risk deduction.", evidenceInputs.filter((item) => item.sourceType === "company-fact")),
    component("price_volume_leadership", "Price and volume leadership", priceVolumeScore, "The standardized 3-month, 6-month, 52-week, drawdown, and accumulation rules are applied to daily bars.", evidenceInputs.filter((item) => item.sourceType === "market-data")),
    component("relative_strength", "Relative strength", relativeStrength.score, `The stock exceeded its ${input.benchmarkSymbol} benchmark by ${round(relativeStrength.excessThreeMonth * 100, 1)} points over three months and ${round(relativeStrength.excessOneYear * 100, 1)} points over one year.`, evidenceInputs.filter((item) => ["three_month_return", "one_year_return"].includes(item.key))),
    component("liquidity_tradability", "Liquidity and tradability", liquidityScore, `Twenty-session average dollar volume is approximately $${Math.round(averageDollarVolume).toLocaleString("en-US")}.`, evidenceInputs.filter((item) => item.key === "average_dollar_volume")),
    component("data_freshness_completeness", "Data freshness and completeness", freshnessScore, `Latest market evidence is ${round(marketAge, 1)} days old; latest comparable annual SEC evidence was filed ${round(filingAge, 0)} days ago.`, evidenceInputs),
  ]);
  const score = round(components.reduce((total, item) => total + item.weightedScore, 0), 1);
  const tier = tierForScore(score);
  const positiveDrivers = components
    .filter((item) => item.score >= 67)
    .sort((left, right) => right.weightedScore - left.weightedScore)
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.explanation}`);
  const negativeDrivers = components
    .filter((item) => item.score < 50)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.explanation}`);
  const confidence = financials.length >= 3 && companyBars.length >= 260 ? "high" : "medium";

  return Object.freeze({
    symbol,
    companyName: input.companyName,
    engineVersion: MONSTER_RATING_ENGINE_VERSION,
    calculatedAt: input.calculatedAt,
    dataAsOf: latestMarketDate,
    dataCompletenessScore: round(freshnessScore),
    evidenceInputs,
    eligible: true,
    eligibilityCode: "eligible",
    score,
    tier,
    confidence,
    components,
    positiveDrivers: Object.freeze(positiveDrivers),
    negativeDrivers: Object.freeze(negativeDrivers),
    summary: `${symbol} has a ${score} ${tier} Monster Rating™ under ${MONSTER_RATING_ENGINE_VERSION}. The score measures current evidence strength, not a probability or recommendation.`,
    risks: negativeDrivers.length > 0
      ? negativeDrivers.join(" ")
      : "No component crossed the model's material deterioration threshold; company and market conditions can still change rapidly.",
  } satisfies EligibleProductionRating);
}
