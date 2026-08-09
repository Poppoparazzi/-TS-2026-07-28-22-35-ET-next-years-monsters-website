// TS: 2026-08-09 13:04 ET

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

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, minimum), maximum) : minimum;
const round = (value: number, digits = 2): number => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};
const average = (values: readonly number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const scale = (value: number, low: number, high: number): number =>
  clamp(((value - low) / (high - low)) * 100);
const safeRatio = (numerator: number | null, denominator: number | null): number | null =>
  numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator;
const percentChange = (current: number | null, prior: number | null): number | null =>
  current === null || prior === null || prior === 0 ? null : ((current - prior) / Math.abs(prior)) * 100;
const timestamp = (value: string): number | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function sortedPeriods(periods: readonly FinancialPeriodEvidence[]): readonly FinancialPeriodEvidence[] {
  return [...periods].filter((period) => timestamp(period.periodEnd) !== null).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

function sortedBars(bars: readonly MarketBarEvidence[]): readonly MarketBarEvidence[] {
  return [...bars]
    .filter((bar) => timestamp(bar.date) !== null && Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(bar.volume) && bar.volume >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function trailingReturn(bars: readonly MarketBarEvidence[], sessions: number): number | null {
  if (bars.length < 2) return null;
  const latest = bars.at(-1);
  const start = bars[Math.max(0, bars.length - 1 - sessions)];
  return latest && start && start.close > 0 ? ((latest.close - start.close) / start.close) * 100 : null;
}

function averageDollarVolume(bars: readonly MarketBarEvidence[], sessions = 20): number | null {
  const selected = bars.slice(-sessions);
  return selected.length ? average(selected.map((bar) => bar.close * bar.volume)) : null;
}

function highProximity(bars: readonly MarketBarEvidence[]): number | null {
  const selected = bars.slice(-252);
  const latest = selected.at(-1);
  if (!latest || !selected.length) return null;
  const high = Math.max(...selected.map((bar) => bar.close));
  return high > 0 ? (latest.close / high) * 100 : null;
}

function volumeRatio(bars: readonly MarketBarEvidence[]): number | null {
  if (bars.length < 40) return null;
  const recent = average(bars.slice(-20).map((bar) => bar.volume));
  const prior = average(bars.slice(-40, -20).map((bar) => bar.volume));
  return prior > 0 ? recent / prior : null;
}

function maximumDrawdown(bars: readonly MarketBarEvidence[]): number | null {
  const selected = bars.slice(-252);
  if (!selected.length) return null;
  let peak = selected[0]?.close ?? 0;
  let worst = 0;
  for (const bar of selected) {
    peak = Math.max(peak, bar.close);
    if (peak > 0) worst = Math.min(worst, ((bar.close - peak) / peak) * 100);
  }
  return Math.abs(worst);
}

function dataCompleteness(periods: readonly FinancialPeriodEvidence[], marketBars: readonly MarketBarEvidence[], benchmarkBars: readonly MarketBarEvidence[]): number {
  const selected = periods.slice(0, MINIMUM_FINANCIAL_PERIODS);
  const possible = MINIMUM_FINANCIAL_PERIODS * FINANCIAL_FIELDS.length;
  let present = 0;
  for (const period of selected) {
    for (const field of FINANCIAL_FIELDS) {
      if (period[field] !== null && Number.isFinite(period[field])) present += 1;
    }
  }
  const financial = possible ? present / possible : 0;
  const companyMarket = clamp(marketBars.length / MINIMUM_MARKET_BARS, 0, 1);
  const benchmarkMarket = clamp(benchmarkBars.length / MINIMUM_MARKET_BARS, 0, 1);
  return round((financial * 0.7 + companyMarket * 0.2 + benchmarkMarket * 0.1) * 100, 1);
}

function evidence(key: string, label: string, value: number | string | boolean | null, unit: string | null, sourceType: RatingEvidenceValue["sourceType"], sourceTimestamp: string | null, sourceUrl: string | null): RatingEvidenceValue {
  return Object.freeze({ key, label, value: typeof value === "number" ? round(value, 4) : value, unit, sourceType, sourceTimestamp, sourceUrl });
}

function buildComponent(key: RatingComponentKey, score: number, explanation: string, values: readonly RatingEvidenceValue[]): RatingComponentResult {
  const spec = RATING_COMPONENT_SPECIFICATIONS.find((item) => item.key === key);
  if (!spec) throw new Error(`Unknown rating component: ${key}`);
  const normalized = round(clamp(score), 1);
  return Object.freeze({
    key,
    label: spec.label,
    score: normalized,
    weight: spec.weight,
    weightedScore: round(normalized * spec.weight, 3),
    direction: normalized >= 60 ? "positive" : normalized < 40 ? "negative" : "neutral",
    explanation,
    evidence: Object.freeze([...values]),
  });
}

function unsupportedSecurityType(type: string | null): boolean {
  return Boolean(type && /(ETF|FUND|TRUST|WARRANT|RIGHT|UNIT|PREFERRED|NOTE|BOND)/i.test(type));
}

function ineligible(input: ProductionRatingInput, completeness: number, reasons: readonly RatingEligibilityReason[], dataAsOf: string | null): ProductionRatingResult {
  const summary = reasons.some((reason) => reason.code === "unresolved_sec_identity")
    ? "Unresolved SEC Identity"
    : reasons.some((reason) => reason.code === "provider_not_connected")
      ? "Provider Not Connected"
      : "Not Yet Rated";
  return Object.freeze({
    symbol: input.symbol,
    companyName: input.companyName,
    engineVersion: MONSTER_RATING_ENGINE_VERSION,
    calculatedAt: input.calculatedAt,
    dataAsOf,
    dataCompletenessScore: completeness,
    evidenceInputs: Object.freeze([]),
    eligible: false,
    eligibilityCode: reasons[0]?.code ?? "incomplete_evidence",
    score: null,
    tier: null,
    confidence: "unavailable",
    components: Object.freeze([]),
    reasons: Object.freeze([...reasons]),
    summary,
  });
}

export function calculateProductionMonsterRating(input: ProductionRatingInput): ProductionRatingResult {
  const calculatedAt = timestamp(input.calculatedAt);
  if (calculatedAt === null) throw new Error("Production rating calculatedAt must be a valid ISO timestamp.");

  const periods = sortedPeriods(input.financialPeriods);
  const marketBars = sortedBars(input.marketBars);
  const benchmarkBars = sortedBars(input.benchmarkBars);
  const latest = periods[0] ?? null;
  const prior = periods[1] ?? null;
  const third = periods[2] ?? null;
  const latestBar = marketBars.at(-1) ?? null;
  const completeness = dataCompleteness(periods, marketBars, benchmarkBars);
  const reasons: RatingEligibilityReason[] = [];

  if (!input.secIdentityResolved || !input.secCik) reasons.push({ code: "unresolved_sec_identity", message: "A verified SEC CIK is required before a Current Stock Rating™ can be calculated.", retryable: true, missingEvidence: Object.freeze(["verified SEC company identity"]) });
  if (!input.marketProviderConfigured || !input.marketProviderName) reasons.push({ code: "provider_not_connected", message: "A licensed external market-data provider is not connected.", retryable: true, missingEvidence: Object.freeze(["licensed price history", "licensed volume history"]) });
  if (unsupportedSecurityType(input.securityType)) reasons.push({ code: "unsupported_security_type", message: "This security type is outside the first production common-equity model.", retryable: false, missingEvidence: Object.freeze(["supported common-equity security type"]) });

  const usablePeriods = periods.filter((period) => period.revenue !== null && (period.dilutedEps !== null || period.netIncome !== null));
  if (usablePeriods.length < MINIMUM_FINANCIAL_PERIODS) reasons.push({ code: "insufficient_financial_history", message: `At least ${MINIMUM_FINANCIAL_PERIODS} comparable financial periods are required.`, retryable: true, missingEvidence: Object.freeze(["comparable revenue history", "comparable earnings history"]) });
  if (marketBars.length < MINIMUM_MARKET_BARS || benchmarkBars.length < MINIMUM_MARKET_BARS) reasons.push({ code: "insufficient_market_history", message: `At least ${MINIMUM_MARKET_BARS} trading sessions are required for the company and benchmark.`, retryable: true, missingEvidence: Object.freeze(["company market history", "benchmark market history"]) });

  if (latestBar) {
    const latestTime = timestamp(latestBar.date);
    const ageDays = latestTime === null ? Number.POSITIVE_INFINITY : (calculatedAt - latestTime) / DAY_MS;
    if (ageDays > MAXIMUM_MARKET_DATA_AGE_DAYS || ageDays < -1) reasons.push({ code: "stale_market_data", message: `The latest market observation is outside the ${MAXIMUM_MARKET_DATA_AGE_DAYS}-day freshness window.`, retryable: true, missingEvidence: Object.freeze(["fresh licensed market observation"]) });
  }

  const dollarVolume20 = averageDollarVolume(marketBars);
  if (dollarVolume20 !== null && dollarVolume20 < MINIMUM_AVERAGE_DOLLAR_VOLUME_20D) reasons.push({ code: "insufficient_liquidity", message: "Average 20-session dollar volume is below the production minimum.", retryable: true, missingEvidence: Object.freeze(["sufficient recent dollar volume"]) });
  if (completeness < MINIMUM_DATA_COMPLETENESS_SCORE) reasons.push({ code: "incomplete_evidence", message: `Verified data completeness is ${completeness}, below the required ${MINIMUM_DATA_COMPLETENESS_SCORE}.`, retryable: true, missingEvidence: Object.freeze(["complete financial evidence", "complete market evidence"]) });

  const dataAsOf = [latest?.filedAt ?? null, latest?.periodEnd ?? null, latestBar?.date ?? null]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
  if (reasons.length || !latest || !prior || !latestBar) return ineligible(input, completeness, reasons.length ? reasons : [{ code: "incomplete_evidence", message: "Required verified evidence was unavailable.", retryable: true, missingEvidence: Object.freeze(["required production evidence"]) }], dataAsOf);

  const revenueGrowth = percentChange(latest.revenue, prior.revenue);
  const priorRevenueGrowth = third ? percentChange(prior.revenue, third.revenue) : null;
  const acceleration = revenueGrowth !== null && priorRevenueGrowth !== null ? revenueGrowth - priorRevenueGrowth : null;
  const earningsGrowth = latest.dilutedEps !== null && prior.dilutedEps !== null ? percentChange(latest.dilutedEps, prior.dilutedEps) : percentChange(latest.netIncome, prior.netIncome);
  const grossMargin = safeRatio(latest.grossProfit, latest.revenue);
  const operatingMargin = safeRatio(latest.operatingIncome, latest.revenue);
  const netMargin = safeRatio(latest.netIncome, latest.revenue);
  const cashFlowMargin = safeRatio(latest.operatingCashFlow, latest.revenue);
  const liabilityRatio = safeRatio(latest.liabilities, latest.assets);
  const cashCoverage = safeRatio(latest.cash, latest.liabilities);
  const return20 = trailingReturn(marketBars, 20);
  const return63 = trailingReturn(marketBars, 63);
  const return126 = trailingReturn(marketBars, 126);
  const benchmark63 = trailingReturn(benchmarkBars, 63);
  const benchmark126 = trailingReturn(benchmarkBars, 126);
  const relativeStrength126 = return126 !== null && benchmark126 !== null ? return126 - benchmark126 : null;
  const proximity = highProximity(marketBars);
  const recentVolume = volumeRatio(marketBars);
  const drawdown = maximumDrawdown(marketBars);

  const businessQuality = average([
    grossMargin === null ? 50 : scale(grossMargin * 100, 10, 60),
    operatingMargin === null ? 50 : scale(operatingMargin * 100, -5, 30),
    netMargin === null ? 50 : scale(netMargin * 100, -10, 25),
    cashFlowMargin === null ? 50 : scale(cashFlowMargin * 100, -5, 30),
    liabilityRatio === null ? 50 : 100 - scale(liabilityRatio * 100, 30, 95),
  ]);
  const growth = average([
    revenueGrowth === null ? 50 : scale(revenueGrowth, -20, 40),
    earningsGrowth === null ? 50 : scale(earningsGrowth, -40, 60),
    acceleration === null ? 50 : scale(acceleration, -20, 20),
  ]);
  const earningsEvidence = average([
    latest.revenue !== null && latest.revenue > 0 ? 75 : 20,
    latest.netIncome !== null ? (latest.netIncome > 0 ? 80 : 25) : 40,
    latest.dilutedEps !== null ? (latest.dilutedEps > 0 ? 80 : 25) : 40,
    latest.operatingCashFlow !== null ? (latest.operatingCashFlow > 0 ? 80 : 25) : 40,
  ]);
  const priceVolume = average([
    return20 === null ? 50 : scale(return20, -20, 25),
    return63 === null ? 50 : scale(return63, -30, 50),
    proximity === null ? 50 : scale(proximity, 65, 100),
    recentVolume === null ? 50 : scale(recentVolume, 0.6, 1.8),
  ]);
  const relativeStrength = relativeStrength126 === null ? 50 : scale(relativeStrength126, -35, 50);
  const marketWeather = average([
    benchmark63 === null ? 50 : scale(benchmark63, -20, 25),
    benchmark126 === null ? 50 : scale(benchmark126, -30, 40),
  ]);
  const liquidity = dollarVolume20 === null ? 0 : scale(Math.log10(Math.max(dollarVolume20, 1)), Math.log10(500_000), Math.log10(500_000_000));
  const risk = average([
    drawdown === null ? 50 : 100 - scale(drawdown, 10, 65),
    liabilityRatio === null ? 50 : 100 - scale(liabilityRatio * 100, 35, 95),
    cashCoverage === null ? 50 : scale(cashCoverage * 100, 2, 50),
    latest.netIncome !== null && latest.netIncome < 0 ? 20 : 75,
  ]);
  const monsterDna = average([businessQuality, earningsEvidence, risk]);
  const tippingPoint = average([growth, priceVolume, relativeStrength]);
  const moveDriver = average([growth, earningsEvidence, recentVolume === null ? 50 : scale(recentVolume, 0.6, 1.8)]);
  const monsterClimb = average([return20 === null ? 50 : scale(return20, -20, 25), return63 === null ? 50 : scale(return63, -30, 50), return126 === null ? 50 : scale(return126, -40, 80), proximity === null ? 50 : scale(proximity, 65, 100)]);

  const financialTimestamp = latest.periodEnd;
  const marketTimestamp = latestBar.date;
  const financialUrl = latest.sourceUrl;
  const components = Object.freeze([
    buildComponent("monster_dna", monsterDna, "Combines business quality, earnings evidence, resilience, and cash generation.", [evidence("operating_margin", "Operating margin", operatingMargin === null ? null : operatingMargin * 100, "%", "derived", financialTimestamp, financialUrl)]),
    buildComponent("tipping_point", tippingPoint, "Tests whether improving fundamentals and market leadership are converging.", [evidence("revenue_growth", "Revenue growth", revenueGrowth, "%", "derived", financialTimestamp, financialUrl)]),
    buildComponent("market_weather", marketWeather, `Measures the ${input.benchmarkSymbol} trend surrounding the calculation.`, [evidence("benchmark_return_126", `${input.benchmarkSymbol} 126-session return`, benchmark126, "%", "market-data", marketTimestamp, null)]),
    buildComponent("move_driver", moveDriver, "Tests whether the current move is supported by financial and volume evidence.", [evidence("earnings_growth", "Earnings growth", earningsGrowth, "%", "derived", financialTimestamp, financialUrl)]),
    buildComponent("monster_climb", monsterClimb, "Measures sustained price progress across multiple horizons.", [evidence("return_126", "126-session return", return126, "%", "market-data", marketTimestamp, null)]),
    buildComponent("business_quality", businessQuality, "Evaluates margins, cash generation, and leverage.", [evidence("gross_margin", "Gross margin", grossMargin === null ? null : grossMargin * 100, "%", "derived", financialTimestamp, financialUrl)]),
    buildComponent("growth_acceleration", growth, "Scores revenue growth, earnings growth, and acceleration.", [evidence("growth_acceleration", "Revenue growth acceleration", acceleration, "percentage points", "derived", financialTimestamp, financialUrl)]),
    buildComponent("earnings_revenue_evidence", earningsEvidence, "Rewards positive verified revenue, earnings, EPS, and cash-flow evidence.", [evidence("revenue", "Revenue", latest.revenue, "reported units", "company-fact", financialTimestamp, financialUrl)]),
    buildComponent("price_volume_leadership", priceVolume, `Uses licensed ${input.marketProviderName} price and volume observations.`, [evidence("volume_ratio", "Recent volume ratio", recentVolume, "x", "market-data", marketTimestamp, null)]),
    buildComponent("relative_strength", relativeStrength, `Compares the company with ${input.benchmarkSymbol}.`, [evidence("relative_strength_126", `126-session return versus ${input.benchmarkSymbol}`, relativeStrength126, "percentage points", "derived", marketTimestamp, null)]),
    buildComponent("liquidity_tradability", liquidity, "Measures recent average dollar volume.", [evidence("average_dollar_volume_20", "Average 20-session dollar volume", dollarVolume20, "USD", "derived", marketTimestamp, null)]),
    buildComponent("risk_deterioration", risk, "Higher scores indicate fewer current deterioration signals.", [evidence("maximum_drawdown", "Trailing maximum drawdown", drawdown, "%", "derived", marketTimestamp, null)]),
    buildComponent("data_freshness_completeness", completeness, "Reports verified data completeness at calculation time.", [evidence("data_completeness", "Data completeness", completeness, "%", "derived", dataAsOf, null)]),
  ] satisfies readonly RatingComponentResult[]);

  const weightedTotal = components.reduce((sum, component) => sum + component.weightedScore, 0);
  const score = Math.round(clamp(weightedTotal, 1, 100));
  const tier = ratingTier(score);
  const positiveDrivers = components.filter((component) => component.score >= 60).sort((a, b) => b.weightedScore - a.weightedScore).slice(0, 3).map((component) => `${component.label}: ${component.score}`);
  const negativeDrivers = components.filter((component) => component.score < 40).sort((a, b) => a.score - b.score).slice(0, 3).map((component) => `${component.label}: ${component.score}`);
  const evidenceInputs = Object.freeze(components.flatMap((component) => component.evidence));

  return Object.freeze({
    symbol: input.symbol,
    companyName: input.companyName,
    engineVersion: MONSTER_RATING_ENGINE_VERSION,
    calculatedAt: input.calculatedAt,
    dataAsOf,
    dataCompletenessScore: completeness,
    evidenceInputs,
    eligible: true,
    eligibilityCode: "eligible",
    score,
    tier,
    confidence: completeness >= 90 ? "high" : completeness >= 80 ? "medium" : "low",
    components,
    positiveDrivers: Object.freeze(positiveDrivers),
    negativeDrivers: Object.freeze(negativeDrivers),
    summary: `${score} / 100 · ${tier}. ${tierExplanation(tier)}`,
    risks: negativeDrivers.length ? `Current pressure is concentrated in ${negativeDrivers.join("; ")}.` : "No component fell below the material-warning threshold, but market and filing evidence can change.",
  });
}
