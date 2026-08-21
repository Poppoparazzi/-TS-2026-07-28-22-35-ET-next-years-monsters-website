// TS: 2026-08-21 17:31 UTC

import type { DailyMarketHistory, QuoteSnapshot } from "../providers/types.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecFactSnapshot,
  SecFilingSummary,
} from "../sec/types.js";
import type {
  EligibleProductionRating,
  FinancialPeriodEvidence,
  ProductionRatingInput,
  RatingEvidenceValue,
} from "./types.js";

const ANNUAL_FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

type FinancialMetricKey = Exclude<
  keyof FinancialPeriodEvidence,
  "periodEnd" | "fiscalYear" | "fiscalPeriod" | "form" | "filedAt" | "sourceUrl"
>;

const METRIC_KEYS = Object.freeze([
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
] satisfies readonly FinancialMetricKey[]);

interface MutableFinancialPeriod {
  periodEnd: string;
  fiscalYear: number;
  fiscalPeriod: "FY";
  form: string;
  filedAt: string;
  sourceUrl: string;
  values: Partial<Record<FinancialMetricKey, number>>;
}

function factSeries(summary: SecCompanyFactsSummary, key: string): readonly SecFactSnapshot[] {
  const history = summary.history?.[key];
  if (history && history.length > 0) return history;
  const latest = summary.facts[key];
  return latest ? Object.freeze([latest]) : Object.freeze([]);
}

export function buildAnnualFinancialPeriods(
  summary: SecCompanyFactsSummary,
): readonly FinancialPeriodEvidence[] {
  const periods = new Map<number, MutableFinancialPeriod>();

  for (const key of METRIC_KEYS) {
    for (const fact of factSeries(summary, key)) {
      if (
        fact.fiscalYear === null || fact.fiscalPeriod !== "FY" ||
        !ANNUAL_FORMS.has(fact.form) || !Number.isFinite(fact.value)
      ) continue;

      const current = periods.get(fact.fiscalYear);
      if (!current) {
        periods.set(fact.fiscalYear, {
          periodEnd: fact.periodEnd,
          fiscalYear: fact.fiscalYear,
          fiscalPeriod: "FY",
          form: fact.form,
          filedAt: fact.filed,
          sourceUrl: fact.sourceUrl,
          values: { [key]: fact.value },
        });
        continue;
      }

      current.values[key] = fact.value;
      if (fact.filed > current.filedAt) {
        current.periodEnd = fact.periodEnd;
        current.form = fact.form;
        current.filedAt = fact.filed;
        current.sourceUrl = fact.sourceUrl;
      }
    }
  }

  return Object.freeze(
    [...periods.values()]
      .sort((left, right) => left.periodEnd.localeCompare(right.periodEnd))
      .slice(-5)
      .map((period) => Object.freeze({
        periodEnd: period.periodEnd,
        fiscalYear: period.fiscalYear,
        fiscalPeriod: period.fiscalPeriod,
        form: period.form,
        filedAt: period.filedAt,
        revenue: period.values.revenue ?? null,
        grossProfit: period.values.grossProfit ?? null,
        operatingIncome: period.values.operatingIncome ?? null,
        netIncome: period.values.netIncome ?? null,
        dilutedEps: period.values.dilutedEps ?? null,
        assets: period.values.assets ?? null,
        liabilities: period.values.liabilities ?? null,
        shareholdersEquity: period.values.shareholdersEquity ?? null,
        cash: period.values.cash ?? null,
        operatingCashFlow: period.values.operatingCashFlow ?? null,
        sourceUrl: period.sourceUrl,
      })),
  );
}

export function buildProductionRatingInput(input: {
  readonly company: SecCompany;
  readonly facts: SecCompanyFactsSummary;
  readonly companyHistory: DailyMarketHistory;
  readonly benchmarkHistory: DailyMarketHistory;
  readonly benchmarkSymbol?: string;
  readonly calculatedAt?: string;
}): ProductionRatingInput {
  const benchmarkSymbol = (input.benchmarkSymbol ?? "SPY").trim().toUpperCase();
  return Object.freeze({
    symbol: input.company.ticker,
    companyName: input.company.companyName,
    exchange: input.company.exchange,
    securityType: null,
    secIdentityResolved: input.company.cik > 0 && input.facts.cik === input.company.cik,
    secCik: input.company.cikPadded,
    financialPeriods: buildAnnualFinancialPeriods(input.facts),
    marketBars: Object.freeze(input.companyHistory.bars.map((bar) => Object.freeze({
      date: bar.date,
      close: bar.close,
      volume: bar.volume,
    }))),
    benchmarkSymbol,
    benchmarkBars: Object.freeze(input.benchmarkHistory.bars.map((bar) => Object.freeze({
      date: bar.date,
      close: bar.close,
      volume: bar.volume,
    }))),
    marketProviderName: input.companyHistory.provider,
    marketProviderConfigured: true,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
  });
}

export function quoteFromDailyHistory(
  company: SecCompany,
  history: DailyMarketHistory,
): QuoteSnapshot {
  const latest = history.bars.at(-1);
  if (!latest) throw new Error(`No daily market bar is available for ${company.ticker}.`);
  return Object.freeze({
    symbol: company.ticker,
    companyName: company.companyName,
    exchange: company.exchange,
    currency: "USD",
    price: latest.close,
    change: history.bars.length >= 2
      ? latest.close - history.bars.at(-2)!.close
      : null,
    percentChange: history.bars.length >= 2 && history.bars.at(-2)!.close > 0
      ? (latest.close / history.bars.at(-2)!.close - 1) * 100
      : null,
    volume: latest.volume,
    marketSession: "closed",
    freshness: "end-of-day",
    provider: history.provider,
    providerTimestamp: `${latest.date}T00:00:00.000Z`,
    retrievedAt: history.retrievedAt,
    feedDisclosure: history.feedDisclosure,
  });
}

export function buildPublishableRating(input: {
  readonly rating: EligibleProductionRating;
  readonly facts: SecCompanyFactsSummary;
  readonly filings: readonly SecFilingSummary[];
  readonly quote: QuoteSnapshot;
  readonly secProviderName: string;
}): EligibleProductionRating {
  const latestFiling = input.filings[0] ?? null;
  const firstFact = Object.values(input.facts.facts)[0] ?? null;
  const primaryEvidence: RatingEvidenceValue[] = [
    Object.freeze({
      key: "market_price",
      label: "Latest end-of-day market price",
      value: input.quote.price,
      unit: input.quote.currency,
      sourceType: "market-data",
      provider: input.quote.provider,
      sourceUrl: null,
      sourceTimestamp: input.quote.providerTimestamp,
    }),
  ];
  if (latestFiling) {
    primaryEvidence.push(Object.freeze({
      key: "latest_sec_filing",
      label: "Latest official SEC filing",
      value: `${latestFiling.form} filed ${latestFiling.filingDate}`,
      unit: null,
      sourceType: "sec-filing",
      provider: input.secProviderName,
      sourceUrl: latestFiling.primaryDocumentUrl,
      sourceTimestamp: latestFiling.acceptanceDateTime ?? latestFiling.filingDate,
    }));
  }
  if (firstFact) {
    primaryEvidence.push(Object.freeze({
      key: `company_fact_${firstFact.key}`,
      label: firstFact.label || firstFact.key,
      value: firstFact.value,
      unit: firstFact.unit,
      sourceType: "company-fact",
      provider: input.secProviderName,
      sourceUrl: firstFact.sourceUrl || input.facts.sourceUrl,
      sourceTimestamp: input.facts.retrievedAt,
    }));
  }

  const evidenceByKey = new Map<string, RatingEvidenceValue>();
  for (const item of [...primaryEvidence, ...input.rating.evidenceInputs]) {
    evidenceByKey.set(item.key, Object.freeze({
      ...item,
      provider: item.provider ?? (
        item.sourceType === "market-data" ? input.quote.provider : input.secProviderName
      ),
    }));
  }

  return Object.freeze({
    ...input.rating,
    evidenceInputs: Object.freeze([...evidenceByKey.values()]),
  });
}
