// TS: 2026-08-05 08:54 ET

import type { SecFactSnapshot } from "./types.js";

interface SecFactUnitEntry {
  readonly start?: string;
  readonly end?: string;
  readonly val?: number;
  readonly accn?: string;
  readonly fy?: number;
  readonly fp?: string;
  readonly form?: string;
  readonly filed?: string;
}

interface SecFactConcept {
  readonly label?: string;
  readonly description?: string;
  readonly units?: Readonly<Record<string, readonly SecFactUnitEntry[]>>;
}

export interface SecCompanyFactsPayload {
  readonly cik?: number;
  readonly entityName?: string;
  readonly facts?: Readonly<Record<string, Readonly<Record<string, SecFactConcept>>>>;
}

interface FactDefinition {
  readonly key: string;
  readonly taxonomy: string;
  readonly tags: readonly string[];
}

const FACT_DEFINITIONS: readonly FactDefinition[] = Object.freeze([
  {
    key: "revenue",
    taxonomy: "us-gaap",
    tags: Object.freeze([
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ]),
  },
  { key: "grossProfit", taxonomy: "us-gaap", tags: Object.freeze(["GrossProfit"]) },
  {
    key: "operatingIncome",
    taxonomy: "us-gaap",
    tags: Object.freeze(["OperatingIncomeLoss"]),
  },
  {
    key: "netIncome",
    taxonomy: "us-gaap",
    tags: Object.freeze(["NetIncomeLoss", "ProfitLoss"]),
  },
  {
    key: "dilutedEps",
    taxonomy: "us-gaap",
    tags: Object.freeze(["EarningsPerShareDiluted"]),
  },
  { key: "assets", taxonomy: "us-gaap", tags: Object.freeze(["Assets"]) },
  { key: "liabilities", taxonomy: "us-gaap", tags: Object.freeze(["Liabilities"]) },
  {
    key: "shareholdersEquity",
    taxonomy: "us-gaap",
    tags: Object.freeze([
      "StockholdersEquity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ]),
  },
  {
    key: "cash",
    taxonomy: "us-gaap",
    tags: Object.freeze([
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ]),
  },
  {
    key: "operatingCashFlow",
    taxonomy: "us-gaap",
    tags: Object.freeze(["NetCashProvidedByUsedInOperatingActivities"]),
  },
]);

const PERIODIC_FORMS = new Set([
  "10-K",
  "10-K/A",
  "10-Q",
  "10-Q/A",
  "20-F",
  "20-F/A",
  "40-F",
  "40-F/A",
  "6-K",
  "6-K/A",
]);

function filingIndexUrl(cik: number, accessionNumber: string): string {
  const folder = accessionNumber.replaceAll("-", "");
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${folder}/${accessionNumber}-index.html`;
}

function validDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));
}

function validEntry(entry: SecFactUnitEntry): boolean {
  return Boolean(
    validDate(entry.end) &&
      validDate(entry.filed) &&
      entry.accn &&
      entry.form &&
      PERIODIC_FORMS.has(entry.form) &&
      typeof entry.val === "number" &&
      Number.isFinite(entry.val),
  );
}

function compareSnapshots(left: SecFactSnapshot, right: SecFactSnapshot): number {
  const endDifference = right.periodEnd.localeCompare(left.periodEnd);
  if (endDifference !== 0) return endDifference;
  const filedDifference = right.filed.localeCompare(left.filed);
  if (filedDifference !== 0) return filedDifference;
  return right.accessionNumber.localeCompare(left.accessionNumber);
}

function contextIdentity(snapshot: SecFactSnapshot): string {
  return [
    snapshot.unit,
    snapshot.periodStart ?? "",
    snapshot.periodEnd,
    snapshot.fiscalYear ?? "",
    snapshot.fiscalPeriod ?? "",
    snapshot.form.replace(/\/A$/, ""),
  ].join("|");
}

function conceptSnapshots(
  key: string,
  taxonomy: string,
  tag: string,
  concept: SecFactConcept,
  cik: number,
): readonly SecFactSnapshot[] {
  const snapshots: SecFactSnapshot[] = [];
  for (const [unit, entries] of Object.entries(concept.units ?? {})) {
    for (const entry of entries) {
      if (!validEntry(entry) || !entry.end || !entry.filed || !entry.accn || !entry.form) {
        continue;
      }
      snapshots.push(
        Object.freeze({
          key,
          taxonomy,
          tag,
          label: concept.label?.trim() || tag,
          description: concept.description?.trim() || "",
          unit,
          value: entry.val as number,
          form: entry.form,
          fiscalYear: typeof entry.fy === "number" ? entry.fy : null,
          fiscalPeriod: entry.fp?.trim() || null,
          periodStart: validDate(entry.start) ? entry.start : null,
          periodEnd: entry.end,
          filed: entry.filed,
          accessionNumber: entry.accn,
          sourceUrl: filingIndexUrl(cik, entry.accn),
        }),
      );
    }
  }
  return Object.freeze(snapshots.sort(compareSnapshots));
}

export interface ParsedSecFactHistory {
  readonly latest: Readonly<Record<string, SecFactSnapshot>>;
  readonly history: Readonly<Record<string, readonly SecFactSnapshot[]>>;
}

export function parseSecFactHistory(
  payload: SecCompanyFactsPayload,
  cik: number,
): ParsedSecFactHistory {
  const latest: Record<string, SecFactSnapshot> = {};
  const history: Record<string, readonly SecFactSnapshot[]> = {};

  for (const definition of FACT_DEFINITIONS) {
    const taxonomyFacts = payload.facts?.[definition.taxonomy];
    if (!taxonomyFacts) continue;

    const byContext = new Map<string, SecFactSnapshot>();
    for (const tag of definition.tags) {
      const concept = taxonomyFacts[tag];
      if (!concept) continue;
      for (const snapshot of conceptSnapshots(
        definition.key,
        definition.taxonomy,
        tag,
        concept,
        cik,
      )) {
        const identity = contextIdentity(snapshot);
        if (!byContext.has(identity)) byContext.set(identity, snapshot);
      }
    }

    const snapshots = Object.freeze([...byContext.values()].sort(compareSnapshots));
    if (snapshots.length > 0) {
      history[definition.key] = snapshots;
      latest[definition.key] = snapshots[0] as SecFactSnapshot;
    }
  }

  return Object.freeze({
    latest: Object.freeze(latest),
    history: Object.freeze(history),
  });
}
