// TS: 2026-08-09 15:02 ET

import type { SecCompanyFactsSummary, SecFactSnapshot } from "../sec/types.js";
import type { FinancialPeriodEvidence } from "./types.js";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);
const DURATION_KEYS = new Set([
  "revenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "dilutedEps",
  "operatingCashFlow",
]);
const MONETARY_KEYS = new Set([
  "revenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "assets",
  "liabilities",
  "shareholdersEquity",
  "cash",
  "operatingCashFlow",
]);

function validDate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function durationDays(snapshot: SecFactSnapshot): number | null {
  const start = validDate(snapshot.periodStart);
  const end = validDate(snapshot.periodEnd);
  if (start === null || end === null || end < start) return null;
  return Math.round((end - start) / 86_400_000);
}

function isAnnual(snapshot: SecFactSnapshot): boolean {
  if (!ANNUAL_FORMS.has(snapshot.form)) return false;
  if (snapshot.fiscalPeriod && snapshot.fiscalPeriod !== "FY") return false;
  if (!DURATION_KEYS.has(snapshot.key)) return true;
  const days = durationDays(snapshot);
  return days !== null && days >= 250 && days <= 450;
}

function latestFirst(left: SecFactSnapshot, right: SecFactSnapshot): number {
  const filed = right.filed.localeCompare(left.filed);
  if (filed !== 0) return filed;
  return right.accessionNumber.localeCompare(left.accessionNumber);
}

function sameFiscalContext(anchor: SecFactSnapshot, candidate: SecFactSnapshot): boolean {
  if (candidate.periodEnd !== anchor.periodEnd) return false;
  if (
    anchor.fiscalYear !== null &&
    candidate.fiscalYear !== null &&
    anchor.fiscalYear !== candidate.fiscalYear
  ) {
    return false;
  }
  return true;
}

function selectFact(
  history: Readonly<Record<string, readonly SecFactSnapshot[]>>,
  key: string,
  anchor: SecFactSnapshot,
  monetaryUnit: string,
): SecFactSnapshot | null {
  const candidates = (history[key] ?? [])
    .filter(isAnnual)
    .filter((candidate) => sameFiscalContext(anchor, candidate))
    .filter((candidate) => !MONETARY_KEYS.has(key) || candidate.unit === monetaryUnit)
    .sort(latestFirst);
  return candidates[0] ?? null;
}

function value(snapshot: SecFactSnapshot | null): number | null {
  return snapshot && Number.isFinite(snapshot.value) ? snapshot.value : null;
}

function periodIdentity(snapshot: SecFactSnapshot): string {
  return `${snapshot.periodEnd}|${snapshot.fiscalYear ?? ""}|${snapshot.unit}`;
}

export interface FinancialPeriodBuildResult {
  readonly periods: readonly FinancialPeriodEvidence[];
  readonly historyAvailable: boolean;
  readonly rejectedRevenueContexts: readonly {
    readonly periodEnd: string;
    readonly form: string;
    readonly unit: string;
    readonly reason: string;
  }[];
}

export function buildAnnualFinancialPeriods(
  summary: SecCompanyFactsSummary,
  maximumPeriods = 5,
): FinancialPeriodBuildResult {
  const safeMaximum = Math.min(Math.max(Math.trunc(maximumPeriods), 2), 10);
  const history = summary.factHistory;
  if (!history) {
    return Object.freeze({
      periods: Object.freeze([]),
      historyAvailable: false,
      rejectedRevenueContexts: Object.freeze([]),
    });
  }

  const rejectedRevenueContexts: {
    periodEnd: string;
    form: string;
    unit: string;
    reason: string;
  }[] = [];
  const uniqueRevenue = new Map<string, SecFactSnapshot>();

  for (const candidate of history.revenue ?? []) {
    if (!isAnnual(candidate)) {
      rejectedRevenueContexts.push({
        periodEnd: candidate.periodEnd,
        form: candidate.form,
        unit: candidate.unit,
        reason: "Revenue context was not a comparable annual filing duration.",
      });
      continue;
    }
    const identity = periodIdentity(candidate);
    if (!uniqueRevenue.has(identity)) uniqueRevenue.set(identity, candidate);
  }

  const anchors = [...uniqueRevenue.values()]
    .sort((left, right) => {
      const end = right.periodEnd.localeCompare(left.periodEnd);
      return end !== 0 ? end : latestFirst(left, right);
    })
    .slice(0, safeMaximum);

  const periods = anchors.map<FinancialPeriodEvidence>((revenue) => {
    const monetaryUnit = revenue.unit;
    const grossProfit = selectFact(history, "grossProfit", revenue, monetaryUnit);
    const operatingIncome = selectFact(history, "operatingIncome", revenue, monetaryUnit);
    const netIncome = selectFact(history, "netIncome", revenue, monetaryUnit);
    const dilutedEps = selectFact(history, "dilutedEps", revenue, monetaryUnit);
    const assets = selectFact(history, "assets", revenue, monetaryUnit);
    const liabilities = selectFact(history, "liabilities", revenue, monetaryUnit);
    const shareholdersEquity = selectFact(history, "shareholdersEquity", revenue, monetaryUnit);
    const cash = selectFact(history, "cash", revenue, monetaryUnit);
    const operatingCashFlow = selectFact(history, "operatingCashFlow", revenue, monetaryUnit);
    const sourceCandidates = [
      revenue,
      grossProfit,
      operatingIncome,
      netIncome,
      dilutedEps,
      assets,
      liabilities,
      shareholdersEquity,
      cash,
      operatingCashFlow,
    ].filter((item): item is SecFactSnapshot => item !== null);
    const latestFiled = [...sourceCandidates].sort(latestFirst)[0] ?? revenue;

    return Object.freeze({
      periodEnd: revenue.periodEnd,
      fiscalYear: revenue.fiscalYear,
      fiscalPeriod: revenue.fiscalPeriod,
      form: revenue.form,
      filedAt: latestFiled.filed,
      revenue: revenue.value,
      grossProfit: value(grossProfit),
      operatingIncome: value(operatingIncome),
      netIncome: value(netIncome),
      dilutedEps: value(dilutedEps),
      assets: value(assets),
      liabilities: value(liabilities),
      shareholdersEquity: value(shareholdersEquity),
      cash: value(cash),
      operatingCashFlow: value(operatingCashFlow),
      sourceUrl: revenue.sourceUrl,
    });
  });

  return Object.freeze({
    periods: Object.freeze(periods),
    historyAvailable: true,
    rejectedRevenueContexts: Object.freeze(rejectedRevenueContexts),
  });
}
