// TS: 2026-08-09 15:04 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildAnnualFinancialPeriods } from "../src/ratings/financial-periods.js";
import type { SecCompanyFactsSummary, SecFactSnapshot } from "../src/sec/types.js";

function fact(
  key: string,
  value: number,
  options: {
    readonly end: string;
    readonly start?: string | null;
    readonly year: number;
    readonly form?: string;
    readonly period?: string | null;
    readonly unit?: string;
    readonly filed?: string;
    readonly accession?: string;
  },
): SecFactSnapshot {
  return Object.freeze({
    key,
    taxonomy: "us-gaap",
    tag: key,
    label: key,
    description: "test fixture",
    unit: options.unit ?? (key === "dilutedEps" ? "USD/shares" : "USD"),
    value,
    form: options.form ?? "10-K",
    fiscalYear: options.year,
    fiscalPeriod: options.period === undefined ? "FY" : options.period,
    periodStart: options.start === undefined ? `${options.year}-01-01` : options.start,
    periodEnd: options.end,
    filed: options.filed ?? `${options.year + 1}-02-15`,
    accessionNumber: options.accession ?? `0000000001-${String(options.year + 1).slice(-2)}-000001`,
    sourceUrl: `https://www.sec.gov/example/${options.year}`,
  });
}

function summary(): SecCompanyFactsSummary {
  const annual2025 = { end: "2025-12-31", year: 2025 } as const;
  const annual2024 = { end: "2024-12-31", year: 2024 } as const;
  const quarterly2026 = {
    end: "2026-03-31",
    start: "2026-01-01",
    year: 2026,
    form: "10-Q",
    period: "Q1",
  } as const;

  const history: Record<string, readonly SecFactSnapshot[]> = {
    revenue: Object.freeze([
      fact("revenue", 320, quarterly2026),
      fact("revenue", 1_500, annual2025),
      fact("revenue", 1_100, annual2024),
    ]),
    grossProfit: Object.freeze([
      fact("grossProfit", 900, annual2025),
      fact("grossProfit", 600, { ...annual2024, unit: "EUR" }),
    ]),
    operatingIncome: Object.freeze([
      fact("operatingIncome", 300, annual2025),
      fact("operatingIncome", 180, annual2024),
    ]),
    netIncome: Object.freeze([
      fact("netIncome", 220, annual2025),
      fact("netIncome", 120, annual2024),
    ]),
    dilutedEps: Object.freeze([
      fact("dilutedEps", 4.4, annual2025),
      fact("dilutedEps", 2.4, annual2024),
    ]),
    assets: Object.freeze([
      fact("assets", 2_000, { ...annual2025, start: null }),
      fact("assets", 1_700, { ...annual2024, start: null }),
    ]),
    liabilities: Object.freeze([
      fact("liabilities", 650, { ...annual2025, start: null }),
      fact("liabilities", 700, { ...annual2024, start: null }),
    ]),
    shareholdersEquity: Object.freeze([
      fact("shareholdersEquity", 1_350, { ...annual2025, start: null }),
      fact("shareholdersEquity", 1_000, { ...annual2024, start: null }),
    ]),
    cash: Object.freeze([
      fact("cash", 300, { ...annual2025, start: null }),
      fact("cash", 200, { ...annual2024, start: null }),
    ]),
    operatingCashFlow: Object.freeze([
      fact("operatingCashFlow", 310, annual2025),
      fact("operatingCashFlow", 190, annual2024),
    ]),
  };

  return Object.freeze({
    ticker: "TEST",
    cik: 1,
    companyName: "Test Corporation",
    retrievedAt: "2026-08-09T19:00:00.000Z",
    facts: Object.freeze(Object.fromEntries(Object.entries(history).flatMap(([key, values]) => values[0] ? [[key, values[0]]] : []))),
    factHistory: Object.freeze(history),
    sourceUrl: "https://data.sec.gov/example",
    disclosure: "Official SEC Evidence",
  });
}

test("annual period builder excludes quarters and preserves comparable fiscal years", () => {
  const result = buildAnnualFinancialPeriods(summary());
  assert.equal(result.historyAvailable, true);
  assert.equal(result.periods.length, 2);
  assert.deepEqual(result.periods.map((period) => period.periodEnd), ["2025-12-31", "2024-12-31"]);
  assert.equal(result.periods[0]?.revenue, 1_500);
  assert.equal(result.periods[0]?.grossProfit, 900);
  assert.equal(result.periods[0]?.assets, 2_000);
  assert.equal(result.periods[0]?.dilutedEps, 4.4);
  assert.equal(result.rejectedRevenueContexts.length, 1);
});

test("annual period builder refuses to mix monetary units", () => {
  const result = buildAnnualFinancialPeriods(summary());
  assert.equal(result.periods[1]?.revenue, 1_100);
  assert.equal(result.periods[1]?.grossProfit, null);
  assert.equal(result.periods[1]?.operatingIncome, 180);
});

test("annual period builder requires a real annual duration for flow facts", () => {
  const fixture = summary();
  const brokenRevenue = fact("revenue", 1_500, {
    end: "2025-12-31",
    start: "2025-10-01",
    year: 2025,
  });
  const result = buildAnnualFinancialPeriods({
    ...fixture,
    facts: Object.freeze({ ...fixture.facts, revenue: brokenRevenue }),
    factHistory: Object.freeze({ ...(fixture.factHistory ?? {}), revenue: Object.freeze([brokenRevenue]) }),
  });
  assert.equal(result.periods.length, 0);
  assert.equal(result.rejectedRevenueContexts.length, 1);
});

test("annual period builder fails closed when SEC history is absent", () => {
  const fixture = summary();
  const { factHistory: _omitted, ...withoutHistory } = fixture;
  const result = buildAnnualFinancialPeriods(withoutHistory);
  assert.equal(result.historyAvailable, false);
  assert.deepEqual(result.periods, []);
});
