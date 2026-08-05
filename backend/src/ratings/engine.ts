// TS: 2026-08-05 07:24 ET

import {
  MAXIMUM_MARKET_DATA_AGE_DAYS,
  MINIMUM_AVERAGE_DOLLAR_VOLUME_20D,
  MINIMUM_DATA_COMPLETENESS_SCORE,
  MINIMUM_FINANCIAL_PERIODS,
  MINIMUM_MARKET_BARS,
  MONSTER_RATING_ENGINE_VERSION,
  RATING_COMPONENT_SPECIFICATIONS,
  ratingTier,
  tierExplanation,
} from "./spec-v1.js";
import type {
  FinancialPeriodEvidence,
  IneligibleProductionRating,
  MarketBarEvidence,
  ProductionRatingInput,
  ProductionRatingResult,
  RatingComponentKey,
  RatingComponentResult,
  RatingEligibilityReason,
  RatingEvidenceValue,
} from "./types.js";

const DAY_MS = 86_400_000;
const FINANCIAL_FIELDS = [
  "revenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "dilutedEps",
  "assets",
  "liabilities",
  "shareholdersEquity",
  "cash",
  "operatingCashFlow",
] as const;

function clamp(value: number, minimum = 0, maximum = 100): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function scale(value: number, low: number, high: number): number {
  if (high <= low) throw new Error("Scale maximum must be greater than its minimum.");
  return clamp(((value - low) / (high - low)) * 100);
}

function safeRatio(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  const ratio = numerator / denominator;
  return Number.isFinite(ratio) ? ratio : null;
}

function percentChange(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  const result = ((current - prior) / Math.abs(prior)) * 100;
  return Number.isFinite(result) ? result : null;
}

function validDate(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sortedPeriods(periods: readonly FinancialPeriodEvidence[]): readonly FinancialPeriodEvidence[] {
  return [...periods]
    .filter((period) => validDate(period.periodEnd) !== null)
    .sort((left, right) => right.periodEnd.localeCompare(left.periodEnd));
}

function sortedBars(bars: readonly MarketBarEvidence[]): readonly MarketBarEvidence[] {
  return [...bars]
    .filter(
      (bar) =>
        validDate(bar.date) !== null &&
        Number.isFinite(bar.close) &&
        bar.close > 0 &&
        Number.isFinite(bar.volume) &&
        bar.volume >= 0,
    )
    .sort((left, right) => left.date.localeCompare(right.date));
}

function trailingReturn(bars: readonly MarketBarEvidence[], sessions: number): number | null {
  if (bars.length < 2) return null;
  const latest = bars[bars.length - 1];
  const startIndex = Math.max(0, bars.length - 1 - sessions);
  const start = bars[startIndex];
  if (!latest || !start || start.close <= 0) return null;
  return ((latest.close - start.close) / start.close) * 100;
}

function averageDollarVolume(
  bars: readonly MarketBarEvidence[],
  sessions: number,
): number | null {
  const selected = bars.slice(Math.max(0, bars.length - sessions));
  if (selected.length === 0) return null;
  return average(selected.map((bar) => bar.close * bar.volume));
}

function volumeRatio(bars: readonly MarketBarEvidence[]): number | null {
  if (bars.length < 40) return null;
  const latest20 = bars.slice(-20);
  const prior20 = bars.slice(-40, -20);
  const priorAverage = average(prior20.map((bar) => bar.volume));
  if (priorAverage <= 0) return null;
  return average(latest20.map((bar) => bar.volume)) / priorAverage;
}

function annualizedVolatility(bars: readonly MarketBarEvidence[]): number | null {
  const selected = bars.slice(-126);
  if (selected.length < 20) return null;
  const returns: number[] = [];
  for (let index = 1; index < selected.length; index += 1) {
    const prior = selected[index - 1];
    const current = selected[index];
    if (!prior || !current || prior.close <= 0) continue;
    returns.push((current.close - prior.close) / prior.close);
  }
  if (returns.length < 10) return null;
  return standardDeviation(returns) * Math.sqrt(252) * 100;
}

function maximumDrawdown(bars: readonly MarketBarEvidence[]): number | null {
  const selected = bars.slice(-252);
  if (selected.length === 0) return null;
  let peak = selected[0]?.close ?? 0;
  let worst = 0;
  for (const bar of selected) {
    peak = Math.max(peak, bar.close);
    if (peak > 0) worst = Math.min(worst, ((bar.close - peak) / peak) * 100);
  }
  return Math.abs(worst);
}

function highProximity(bars: readonly MarketBarEvidence[]): number | null {
  const selected = bars.slice(-252);
  const latest = selected[selected.length - 1];
  if (!latest || selected.length === 0) return null;
  const high = Math.max(...selected.map((bar) => bar.close));
  return high > 0 ? (latest.close / high) * 100 : null;
}

function dataCompleteness(
  periods: readonly FinancialPeriodEvidence[],
  marketBars: readonly MarketBarEvidence[],
  benchmarkBars: readonly MarketBarEvidence[],
): number {
  const selectedPeriods = periods.slice(0, MINIMUM_FINANCIAL_PERIODS);
  const financialPossible = MINIMUM_FINANCIAL_PERIODS * FINANCIAL_FIELDS.length;
  let financialPresent = 0;
  for (const period of selectedPeriods) {
    for (const field of FINANCIAL_FIELDS) {
      if (period[field] !== null && Number.isFinite(period[field])) financialPresent += 1;
    }
  }

  const financialScore = financialPossible > 0 ? financialPresent / financialPossible : 0;
  const companyMarketScore = clamp(marketBars.length / MINIMUM_MARKET_BARS, 0, 1);
  const benchmarkMarketScore = clamp(benchmarkBars.length / MINIMUM_MARKET_BARS, 0, 1);
  return round((financialScore * 0.7 + companyMarketScore * 0.2 + benchmarkMarketScore * 0.1) * 100, 1);
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
  return Object.freeze({
    key,
    label,
    value: typeof value === "number" ? round(value, 4) : value,
    unit,
    sourceType,
    sourceTimestamp,
    sourceUrl,
  });
}

function componentDirection(score: number): RatingComponentResult["direction"] {
  if (score >= 60) return "positive";
  if (score < 40) return "negative";
  return "neutral";
}

function buildComponent(
  key: RatingComponentKey,
  score: number,
  explanation: string,
  componentEvidence: readonly RatingEvidenceValue[],
): RatingComponentResult {
  const specification = RATING_COMPONENT_SPECIFICATIONS.find((item) => item.key === key);
  if (!specification) throw new Error(`Unknown rating component: ${key}`);
  const normalizedScore = round(clamp(score), 1);
  return Object.freeze({
    key,
    label: specification.label,
    score: normalizedScore,
    weight: specification.weight,
    weightedScore: round(normalizedScore * specification.weight, 3),
    direction: componentDirection(normalizedScore),
    explanation,
    evidence: Object.freeze([...componentEvidence]),
  });
}

function deduplicateEvidence(values: readonly RatingEvidenceValue[]): readonly RatingEvidenceValue[] {
  const unique = new Map<string, RatingEvidenceValue>();
  for (const value of values) {
    const identity = `${value.key}|${value.sourceTimestamp ?? ""}|${value.sourceUrl ?? ""}`;
    if (!unique.has(identity)) unique.set(identity, value);
  }
  return Object.freeze([...unique.values()]);
}

function ineligibleSummary(
  reasons: readonly RatingEligibilityReason[],
): IneligibleProductionRating["summary"] {
  if (reasons.some((reason) => reason.code === "unresolved_sec_identity")) {
    return "Unresolved SEC Identity";
  }
  if (reasons.some((reason) => reason.code === "provider_not_connected")) {
    return "Provider Not Connected";
  }
  return "Not Yet Rated";
}

function unsupportedSecurityType(securityType: string | null): boolean {
  if (!securityType) return false;
  return /(ETF|FUND|TRUST|WARRANT|RIGHT|UNIT|PREFERRED|NOTE|BOND)/i.test(securityType);
}

function newestTimestamp(values: readonly (string | null)[]): string | null {
  let newest: { readonly text: string; readonly time: number } | null = null;
  for (const value of values) {
    if (!value) continue;
    const time = validDate(value);
    if (time === null) continue;
    if (!newest || time > newest.time) newest = { text: value, time };
  }
  return newest?.text ?? null;
}

export function calculateProductionMonsterRating(
  input: ProductionRatingInput,
): ProductionRatingResult {
  const periods = sortedPeriods(input.financialPeriods);
  const marketBars = sortedBars(input.marketBars);
  const benchmarkBars = sortedBars(input.benchmarkBars);
  const latestPeriod = periods[0] ?? null;
  const priorPeriod = periods[1] ?? null;
  const thirdPeriod = periods[2] ?? null;
  const latestMarketBar = marketBars[marketBars.length - 1] ?? null;
  const calculatedAtTimestamp = validDate(input.calculatedAt);
  if (calculatedAtTimestamp === null) {
    throw new Error("Production rating calculatedAt must be a valid ISO timestamp.");
  }

  const completeness = dataCompleteness(periods, marketBars, benchmarkBars);
  const reasons: RatingEligibilityReason[] = [];

  if (!input.secIdentityResolved || !input.secCik) {
    reasons.push({
      code: "unresolved_sec_identity",
      message: "A verified SEC CIK is required before a production Monster Rating™ can be calculated.",
      retryable: true,
      missingEvidence: Object.freeze(["verified SEC company identity"]),
    });
  }

  if (!input.marketProviderConfigured || !input.marketProviderName) {
    reasons.push({
      code: "provider_not_connected",
      message: "A licensed external market-data provider is not connected.",
      retryable: true,
      missingEvidence: Object.freeze(["licensed price history", "licensed volume history"]),
    });
  }

  if (unsupportedSecurityType(input.securityType)) {
    reasons.push({
      code: "unsupported_security_type",
      message: `Security type ${input.securityType ?? "unknown"} is outside the first production equity model.`,
      retryable: false,
      missingEvidence: Object.freeze(["supported common-equity security type"]),
    });
  }

  const usableFinancialPeriods = periods.filter(
    (period) =>
      period.revenue !== null && (period.dilutedEps !== null || period.netIncome !== null),
  );
  if (usableFinancialPeriods.length < MINIMUM_FINANCIAL_PERIODS) {
    reasons.push({
      code: "insufficient_financial_history",
      message: `At least ${MINIMUM_FINANCIAL_PERIODS} comparable periods with revenue and earnings evidence are required.`,
      retryable: true,
      missingEvidence: Object.freeze(["comparable revenue history", "comparable earnings history"]),
    });
  }

  if (marketBars.length < MINIMUM_MARKET_BARS || benchmarkBars.length < MINIMUM_MARKET_BARS) {
    reasons.push({
      code: "insufficient_market_history",
      message: `At least ${MINIMUM_MARKET_BARS} valid trading sessions are required for both the company and benchmark.`,
      retryable: true,
      missingEvidence: Object.freeze(["company price and volume history", "benchmark price history"]),
    });
  }

  if (latestMarketBar) {
    const latestMarketTimestamp = validDate(latestMarketBar.date);
    const ageDays =
      latestMarketTimestamp === null
        ? Number.POSITIVE_INFINITY
        : (calculatedAtTimestamp - latestMarketTimestamp) / DAY_MS;
    if (ageDays > MAXIMUM_MARKET_DATA_AGE_DAYS || ageDays < -1) {
      reasons.push({
        code: "stale_market_data",
        message: `The latest market observation is outside the ${MAXIMUM_MARKET_DATA_AGE_DAYS}-day freshness window.`,
        retryable: true,
        missingEvidence: Object.freeze(["current licensed market observation"]),
      });
    }
  }

  const dollarVolume20 = averageDollarVolume(marketBars, 20);
  if (dollarVolume20 !== null && dollarVolume20 < MINIMUM_AVERAGE_DOLLAR_VOLUME_20D) {
    reasons.push({
      code: "insufficient_liquidity",
      message: "Average 20-session dollar volume is below the minimum tradability threshold.",
      retryable: true,
      missingEvidence: Object.freeze(["sufficient recent dollar volume"]),
    });
  }

  if (completeness < MINIMUM_DATA_COMPLETENESS_SCORE) {
    reasons.push({
      code: "incomplete_evidence",
      message: `Verified data completeness is ${completeness}, below the required ${MINIMUM_DATA_COMPLETENESS_SCORE}.`,
      retryable: true,
      missingEvidence: Object.freeze(["complete financial evidence", "complete market evidence"]),
    });
  }

  const dataAsOf = newestTimestamp([
    latestPeriod?.filedAt ?? null,
    latestPeriod?.periodEnd ?? null,
    latestMarketBar?.date ?? null,
  ]);

  if (reasons.length > 0 || !latestPeriod || !priorPeriod || !latestMarketBar) {
    const primaryCode = reasons[0]?.code ?? "incomplete_evidence";
    return Object.freeze({
      symbol: input.symbol,
      companyName: input.companyName,
      engineVersion: MONSTER_RATING_ENGINE_VERSION,
      calculatedAt: input.calculatedAt,
      dataAsOf,
      dataCompletenessScore: completeness,
      evidenceInputs: Object.freeze([]),
      eligible: false,
      eligibilityCode: primaryCode,
      score: null,
      tier: null,
      confidence: "unavailable",
      components: Object.freeze([]),
      reasons: Object.freeze(reasons.length > 0 ? reasons : [
        {
          code: "incomplete_evidence",
          message: "Required verified evidence was unavailable.",
          retryable: true,
          missingEvidence: Object.freeze(["required production evidence"]),
        },
      ]),
      summary: ineligibleSummary(reasons),
    });
  }

  const revenueGrowth = percentChange(latestPeriod.revenue, priorPeriod.revenue);
  const priorRevenueGrowth = thirdPeriod
    ? percentChange(priorPeriod.revenue, thirdPeriod.revenue)
    : null;
  const growthAcceleration =
    revenueGrowth !== null && priorRevenueGrowth !== null
      ? revenueGrowth - priorRevenueGrowth
      : null;
  const earningsGrowth =
    latestPeriod.dilutedEps !== null && priorPeriod.dilutedEps !== null
      ? percentChange(latestPeriod.dilutedEps, priorPeriod.dilutedEps)
      : percentChange(latestPeriod.netIncome, priorPeriod.netIncome);
  const grossMargin = safeRatio(latestPeriod.grossProfit, latestPeriod.revenue);
  const operatingMargin = safeRatio(latestPeriod.operatingIncome, latestPeriod.revenue);
  const netMargin = safeRatio(latestPeriod.netIncome, latestPeriod.revenue);
  const operatingCashFlowMargin = safeRatio(
    latestPeriod.operatingCashFlow,
    latestPeriod.revenue,
  );
  const returnOnAssets = safeRatio(latestPeriod.netIncome, latestPeriod.assets);
  const liabilityRatio = safeRatio(latestPeriod.liabilities, latestPeriod.assets);
  const cashCoverage = safeRatio(latestPeriod.cash, latestPeriod.liabilities);

  const return20 = trailingReturn(marketBars, 20);
  const return63 = trailingReturn(marketBars, 63);
  const return126 = trailingReturn(marketBars, 126);
  const benchmarkReturn63 = trailingReturn(benchmarkBars, 63);
  const benchmarkReturn126 = trailingReturn(benchmarkBars, 126);
  const relativeStrength126 =
    return126 !== null && benchmarkReturn126 !== null ? return126 - benchmarkReturn126 : null;
  const proximityToHigh = highProximity(marketBars);
  const recentVolumeRatio = volumeRatio(marketBars);
  const volatility = annualizedVolatility(marketBars);
  const drawdown = maximumDrawdown(marketBars);

  const businessQualityScore = average([
    grossMargin === null ? 50 : scale(grossMargin * 100, 10, 60),
    operatingMargin === null ? 50 : scale(operatingMargin * 100, -5, 30),
    netMargin === null ? 50 : scale(netMargin * 100, -10, 25),
    operatingCashFlowMargin === null ? 50 : scale(operatingCashFlowMargin * 100, -5, 30),
    returnOnAssets === null ? 50 : scale(returnOnAssets * 100, -5, 20),
    liabilityRatio === null ? 50 : 100 - scale(liabilityRatio * 100, 30, 95),
  ]);

  const growthScore = average([
    revenueGrowth === null ? 50 : scale(revenueGrowth, -20, 40),
    earningsGrowth === null ? 50 : scale(earningsGrowth, -40, 60),
    growthAcceleration === null ? 50 : scale(growthAcceleration, -20, 20),
  ]);

  const earningsEvidenceScore = average([
    latestPeriod.revenue !== null && latestPeriod.revenue > 0 ? 75 : 20,
    latestPeriod.netIncome !== null
      ? latestPeriod.netIncome > 0
        ? 80
        : 25
      : 40,
    latestPeriod.dilutedEps !== null
      ? latestPeriod.dilutedEps > 0
        ? 80
        : 25
      : 40,
    latestPeriod.operatingCashFlow !== null
      ? latestPeriod.operatingCashFlow > 0
        ? 80
        : 25
      : 40,
  ]);

  const priceVolumeScore = average([
    return20 === null ? 50 : scale(return20, -20, 25),
    return63 === null ? 50 : scale(return63, -30, 50),
    proximityToHigh === null ? 50 : scale(proximityToHigh, 65, 100),
    recentVolumeRatio === null ? 50 : scale(recentVolumeRatio, 0.6, 1.8),
  ]);

  const relativeStrengthScore =
    relativeStrength126 === null ? 50 : scale(relativeStrength126, -35, 50);
  const marketWeatherScore = average([
    benchmarkReturn63 === null ? 50 : scale(benchmarkReturn63, -20, 25),
    benchmarkReturn126 === null ? 50 : scale(benchmarkReturn126, -30, 40),
  ]);
  const liquidityScore =
    dollarVolume20 === null
      ? 0
      : scale(Math.log10(Math.max(dollarVolume20, 1)), Math.log10(500_000), Math.log10(500_000_000));
  const riskScore = average([
    volatility === null ? 50 : 100 - scale(volatility, 20, 100),
    drawdown === null ? 50 : 100 - scale(drawdown, 10, 65),
    liabilityRatio === null ? 50 : 100 - scale(liabilityRatio * 100, 35, 95),
    cashCoverage === null ? 50 : scale(cashCoverage * 100, 2, 50),
    latestPeriod.netIncome !== null && latestPeriod.netIncome < 0 ? 20 : 75,
  ]);
  const monsterDnaScore = average([businessQualityScore, earningsEvidenceScore, riskScore]);
  const tippingPointScore = average([growthScore, priceVolumeScore, relativeStrengthScore]);
  const moveDriverScore = average([
    revenueGrowth === null ? 50 : scale(revenueGrowth, -20, 40),
    earningsGrowth === null ? 50 : scale(earningsGrowth, -40, 60),
    recentVolumeRatio === null ? 50 : scale(recentVolumeRatio, 0.6, 1.8),
  ]);
  const monsterClimbScore = average([
    return20 === null ? 50 : scale(return20, -20, 25),
    return63 === null ? 50 : scale(return63, -30, 50),
    return126 === null ? 50 : scale(return126, -40, 80),
    proximityToHigh === null ? 50 : scale(proximityToHigh, 65, 100),
  ]);

  const financialTimestamp = latestPeriod.periodEnd;
  const marketTimestamp = latestMarketBar.date;
  const financialUrl = latestPeriod.sourceUrl;
  const marketProvider = input.marketProviderName ?? "unknown";

  const components: readonly RatingComponentResult[] = Object.freeze([
    buildComponent(
      "monster_dna",
      monsterDnaScore,
      "Combines durable business quality, earnings evidence, balance-sheet resilience, and cash generation.",
      [
        evidence("operating_margin", "Operating margin", operatingMargin === null ? null : operatingMargin * 100, "%", "derived", financialTimestamp, financialUrl),
        evidence("operating_cash_flow_margin", "Operating cash flow margin", operatingCashFlowMargin === null ? null : operatingCashFlowMargin * 100, "%", "derived", financialTimestamp, financialUrl),
        evidence("liability_ratio", "Liabilities to assets", liabilityRatio === null ? null : liabilityRatio * 100, "%", "derived", financialTimestamp, financialUrl),
      ],
    ),
    buildComponent(
      "tipping_point",
      tippingPointScore,
      "Measures whether improving fundamentals and market leadership are converging rather than merely appearing in isolation.",
      [
        evidence("revenue_growth", "Revenue growth", revenueGrowth, "%", "derived", financialTimestamp, financialUrl),
        evidence("relative_strength_126", `126-session return versus ${input.benchmarkSymbol}`, relativeStrength126, "percentage points", "derived", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "market_weather",
      marketWeatherScore,
      `Measures the ${input.benchmarkSymbol} trend surrounding the company calculation.`,
      [
        evidence("benchmark_return_63", `${input.benchmarkSymbol} 63-session return`, benchmarkReturn63, "%", "market-data", marketTimestamp, null),
        evidence("benchmark_return_126", `${input.benchmarkSymbol} 126-session return`, benchmarkReturn126, "%", "market-data", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "move_driver",
      moveDriverScore,
      "Tests whether the current move is supported by revenue, earnings, and volume evidence.",
      [
        evidence("revenue_growth", "Revenue growth", revenueGrowth, "%", "derived", financialTimestamp, financialUrl),
        evidence("earnings_growth", "Earnings growth", earningsGrowth, "%", "derived", financialTimestamp, financialUrl),
        evidence("volume_ratio", "Recent volume ratio", recentVolumeRatio, "x", "market-data", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "monster_climb",
      monsterClimbScore,
      "Measures sustained price progress across multiple horizons and proximity to the trailing high.",
      [
        evidence("return_20", "20-session return", return20, "%", "market-data", marketTimestamp, null),
        evidence("return_63", "63-session return", return63, "%", "market-data", marketTimestamp, null),
        evidence("return_126", "126-session return", return126, "%", "market-data", marketTimestamp, null),
        evidence("high_proximity", "Proximity to trailing high", proximityToHigh, "%", "derived", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "business_quality",
      businessQualityScore,
      "Evaluates margins, cash conversion, returns on assets, and leverage from verified financial evidence.",
      [
        evidence("gross_margin", "Gross margin", grossMargin === null ? null : grossMargin * 100, "%", "derived", financialTimestamp, financialUrl),
        evidence("net_margin", "Net margin", netMargin === null ? null : netMargin * 100, "%", "derived", financialTimestamp, financialUrl),
        evidence("return_on_assets", "Return on assets", returnOnAssets === null ? null : returnOnAssets * 100, "%", "derived", financialTimestamp, financialUrl),
      ],
    ),
    buildComponent(
      "growth_acceleration",
      growthScore,
      "Scores revenue growth, earnings growth, and acceleration when a third comparable period exists.",
      [
        evidence("revenue_growth", "Revenue growth", revenueGrowth, "%", "derived", financialTimestamp, financialUrl),
        evidence("earnings_growth", "Earnings growth", earningsGrowth, "%", "derived", financialTimestamp, financialUrl),
        evidence("growth_acceleration", "Revenue growth acceleration", growthAcceleration, "percentage points", "derived", financialTimestamp, financialUrl),
      ],
    ),
    buildComponent(
      "earnings_revenue_evidence",
      earningsEvidenceScore,
      "Rewards positive, available revenue, earnings, EPS, and operating-cash-flow evidence without filling missing fields.",
      [
        evidence("revenue", "Revenue", latestPeriod.revenue, "reported units", "company-fact", financialTimestamp, financialUrl),
        evidence("net_income", "Net income", latestPeriod.netIncome, "reported units", "company-fact", financialTimestamp, financialUrl),
        evidence("diluted_eps", "Diluted EPS", latestPeriod.dilutedEps, "reported units", "company-fact", financialTimestamp, financialUrl),
        evidence("operating_cash_flow", "Operating cash flow", latestPeriod.operatingCashFlow, "reported units", "company-fact", financialTimestamp, financialUrl),
      ],
    ),
    buildComponent(
      "price_volume_leadership",
      priceVolumeScore,
      `Uses licensed ${marketProvider} price and volume observations to measure leadership.`,
      [
        evidence("return_63", "63-session return", return63, "%", "market-data", marketTimestamp, null),
        evidence("high_proximity", "Proximity to trailing high", proximityToHigh, "%", "derived", marketTimestamp, null),
        evidence("volume_ratio", "Recent volume ratio", recentVolumeRatio, "x", "market-data", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "relative_strength",
      relativeStrengthScore,
      `Compares the company’s 126-session return with ${input.benchmarkSymbol}.`,
      [
        evidence("relative_strength_126", `126-session return versus ${input.benchmarkSymbol}`, relativeStrength126, "percentage points", "derived", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "liquidity_tradability",
      liquidityScore,
      "Measures recent average dollar volume against the production tradability range.",
      [
        evidence("average_dollar_volume_20", "Average 20-session dollar volume", dollarVolume20, "USD", "derived", marketTimestamp, null),
      ],
    ),
    buildComponent(
      "risk_deterioration",
      riskScore,
      "A higher score indicates fewer current deterioration signals across volatility, drawdown, leverage, cash coverage, and profitability.",
      [
        evidence("annualized_volatility", "Annualized volatility", volatility, "%", "derived", marketTimestamp, null),
        evidence("maximum_drawdown", "Trailing maximum drawdown", drawdown, "%", "derived", marketTimestamp, null),
        evidence("liability_ratio", "Liabilities to assets", liabilityRatio === null ? null : liabilityRatio * 100, "%", "derived", financialTimestamp, financialUrl),
        evidence("cash_coverage", "Cash to liabilities", cashCoverage === null ? null : cashCoverage * 100, "%", "derived", financialTimestamp, financialUrl),
      ],
    ),
    buildComponent(
      "data_freshness_completeness",
      completeness,
      "Reports how much of the minimum verified financial and market evidence was present at calculation time.",
      [
        evidence("data_completeness", "Data completeness", completeness, "%", "derived", dataAsOf, null),
        evidence("financial_period_count", "Comparable financial periods", usableFinancialPeriods.length, "periods", "derived", financialTimestamp, financialUrl),
        evidence("market_bar_count", "Company market observations", marketBars.length, "sessions", "market-data", marketTimestamp, null),
        evidence("benchmark_bar_count", "Benchmark market observations", benchmarkBars.length, "sessions", "market-data", marketTimestamp, null),
      ],
    ),
  ]);

  const weightedTotal = components.reduce((sum, component) => sum + component.weightedScore, 0);
  const finalScore = Math.round(clamp(weightedTotal, 1, 100));
  const tier = ratingTier(finalScore);
  const positiveDrivers = components
    .filter((component) => component.score >= 60)
    .sort((left, right) => right.weightedScore - left.weightedScore)
    .slice(0, 3)
    .map((component) => `${component.label}: ${component.score}`);
  const negativeDrivers = components
    .filter((component) => component.score < 40)
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .map((component) => `${component.label}: ${component.score}`);
  const confidence = completeness >= 90 ? "high" : completeness >= 80 ? "medium" : "low";
  const risks =
    negativeDrivers.length > 0
      ? `Current pressure is concentrated in ${negativeDrivers.join("; ")}.`
      : "No component fell below the model’s material-warning threshold, but market and filing evidence can change.";

  return Object.freeze({
    symbol: input.symbol,
    companyName: input.companyName,
    engineVersion: MONSTER_RATING_ENGINE_VERSION,
    calculatedAt: input.calculatedAt,
    dataAsOf,
    dataCompletenessScore: completeness,
    evidenceInputs: deduplicateEvidence(components.flatMap((component) => component.evidence)),
    eligible: true,
    eligibilityCode: "eligible",
    score: finalScore,
    tier,
    confidence,
    components,
    positiveDrivers: Object.freeze(positiveDrivers),
    negativeDrivers: Object.freeze(negativeDrivers),
    summary: `${finalScore} / 100 · ${tier}. ${tierExplanation(tier)}`,
    risks,
  });
}
