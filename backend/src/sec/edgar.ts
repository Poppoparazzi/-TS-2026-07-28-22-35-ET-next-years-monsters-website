// TS: 2026-07-29 12:08 ET

import {
  type SecCompany,
  type SecCompanyFactsSummary,
  type SecDataProvider,
  type SecFactSnapshot,
  type SecFilingSummary,
  SecCompanyNotFoundError,
} from "./types.js";

const SEC_FILES_BASE_URL = "https://www.sec.gov/files";
const SEC_DATA_BASE_URL = "https://data.sec.gov";
const SEC_ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/edgar/data";
const TICKER_MAP_TTL_MS = 6 * 60 * 60 * 1_000;
const MIN_REQUEST_INTERVAL_MS = 125;
const SEC_DISCLOSURE =
  "Official SEC EDGAR submissions and XBRL company facts. Facts retain their filing form, fiscal period, unit, dates, and source filing so context is not concealed.";

interface SecTickerExchangeResponse {
  readonly fields?: readonly string[];
  readonly data?: readonly (readonly unknown[])[];
}

interface SecRecentFilings {
  readonly accessionNumber?: readonly string[];
  readonly filingDate?: readonly string[];
  readonly reportDate?: readonly string[];
  readonly acceptanceDateTime?: readonly string[];
  readonly form?: readonly string[];
  readonly fileNumber?: readonly string[];
  readonly primaryDocument?: readonly string[];
}

interface SecSubmissionsResponse {
  readonly cik?: string;
  readonly name?: string;
  readonly tickers?: readonly string[];
  readonly exchanges?: readonly string[];
  readonly filings?: {
    readonly recent?: SecRecentFilings;
  };
}

interface SecFactUnitEntry {
  readonly start?: string;
  readonly end?: string;
  readonly val?: number;
  readonly accn?: string;
  readonly fy?: number;
  readonly fp?: string;
  readonly form?: string;
  readonly filed?: string;
  readonly frame?: string;
}

interface SecFactConcept {
  readonly label?: string;
  readonly description?: string;
  readonly units?: Readonly<Record<string, readonly SecFactUnitEntry[]>>;
}

interface SecCompanyFactsResponse {
  readonly cik?: number;
  readonly entityName?: string;
  readonly facts?: Readonly<Record<string, Readonly<Record<string, SecFactConcept>>>>;
}

interface FactDefinition {
  readonly key: string;
  readonly taxonomy: string;
  readonly tags: readonly string[];
}

const FACT_DEFINITIONS: readonly FactDefinition[] = [
  {
    key: "revenue",
    taxonomy: "us-gaap",
    tags: [
      "RevenueFromContractWithCustomerExcludingAssessedTax",
      "Revenues",
      "SalesRevenueNet",
    ],
  },
  { key: "grossProfit", taxonomy: "us-gaap", tags: ["GrossProfit"] },
  { key: "operatingIncome", taxonomy: "us-gaap", tags: ["OperatingIncomeLoss"] },
  { key: "netIncome", taxonomy: "us-gaap", tags: ["NetIncomeLoss", "ProfitLoss"] },
  { key: "dilutedEps", taxonomy: "us-gaap", tags: ["EarningsPerShareDiluted"] },
  { key: "assets", taxonomy: "us-gaap", tags: ["Assets"] },
  { key: "liabilities", taxonomy: "us-gaap", tags: ["Liabilities"] },
  { key: "shareholdersEquity", taxonomy: "us-gaap", tags: ["StockholdersEquity"] },
  {
    key: "cash",
    taxonomy: "us-gaap",
    tags: [
      "CashAndCashEquivalentsAtCarryingValue",
      "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    ],
  },
  {
    key: "operatingCashFlow",
    taxonomy: "us-gaap",
    tags: ["NetCashProvidedByUsedInOperatingActivities"],
  },
];

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

function normalizeSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();

  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }

  return normalized;
}

function paddedCik(cik: number): string {
  return String(cik).padStart(10, "0");
}

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function filingIndexUrl(cik: number, accessionNumber: string): string {
  const folder = accessionNumber.replaceAll("-", "");
  return `${SEC_ARCHIVES_BASE_URL}/${cik}/${folder}/${accessionNumber}-index.html`;
}

function filingDocumentUrl(
  cik: number,
  accessionNumber: string,
  primaryDocument: string,
): string {
  const folder = accessionNumber.replaceAll("-", "");
  return `${SEC_ARCHIVES_BASE_URL}/${cik}/${folder}/${encodeURIComponent(primaryDocument)}`;
}

function compareFactEntries(a: SecFactUnitEntry, b: SecFactUnitEntry): number {
  const endComparison = (a.end ?? "").localeCompare(b.end ?? "");
  return endComparison !== 0 ? endComparison : (a.filed ?? "").localeCompare(b.filed ?? "");
}

function latestFact(
  key: string,
  taxonomy: string,
  tag: string,
  concept: SecFactConcept,
  cik: number,
): SecFactSnapshot | null {
  const candidates: { readonly unit: string; readonly entry: SecFactUnitEntry }[] = [];

  for (const [unit, entries] of Object.entries(concept.units ?? {})) {
    for (const entry of entries) {
      if (
        entry.end &&
        entry.filed &&
        entry.accn &&
        entry.form &&
        PERIODIC_FORMS.has(entry.form) &&
        typeof entry.val === "number" &&
        Number.isFinite(entry.val)
      ) {
        candidates.push({ unit, entry });
      }
    }
  }

  candidates.sort((a, b) => compareFactEntries(b.entry, a.entry));
  const selected = candidates[0];
  if (!selected?.entry.end || !selected.entry.filed || !selected.entry.accn || !selected.entry.form) {
    return null;
  }

  return {
    key,
    taxonomy,
    tag,
    label: concept.label?.trim() || tag,
    description: concept.description?.trim() || "",
    unit: selected.unit,
    value: selected.entry.val as number,
    form: selected.entry.form,
    fiscalYear: typeof selected.entry.fy === "number" ? selected.entry.fy : null,
    fiscalPeriod: selected.entry.fp?.trim() || null,
    periodStart: selected.entry.start?.trim() || null,
    periodEnd: selected.entry.end,
    filed: selected.entry.filed,
    accessionNumber: selected.entry.accn,
    sourceUrl: filingIndexUrl(cik, selected.entry.accn),
  };
}

export class SecEdgarDataProvider implements SecDataProvider {
  public readonly name = "sec-edgar";
  public readonly configured = true;

  private tickerCache:
    | {
        readonly expiresAt: number;
        readonly byTicker: ReadonlyMap<string, SecCompany>;
      }
    | null = null;

  private requestGate: Promise<void> = Promise.resolve();
  private lastRequestStartedAt = 0;

  public constructor(private readonly userAgent: string) {
    if (!userAgent.trim()) {
      throw new Error("SEC user agent is required.");
    }
  }

  private async waitForFairAccess(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestStartedAt;
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);

    if (waitMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    }
  }

  private async requestJson<T>(url: string): Promise<T> {
    const request = this.requestGate.then(async () => {
      await this.waitForFairAccess();
      this.lastRequestStartedAt = Date.now();

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": this.userAgent,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`SEC EDGAR request failed with HTTP ${response.status}.`);
      }

      return (await response.json()) as T;
    });

    this.requestGate = request.then(
      () => undefined,
      () => undefined,
    );

    return request;
  }

  private async loadTickerMap(): Promise<ReadonlyMap<string, SecCompany>> {
    if (this.tickerCache && this.tickerCache.expiresAt > Date.now()) {
      return this.tickerCache.byTicker;
    }

    const sourceUrl = `${SEC_FILES_BASE_URL}/company_tickers_exchange.json`;
    const payload = await this.requestJson<SecTickerExchangeResponse>(sourceUrl);
    const fields = payload.fields ?? [];
    const cikIndex = fields.indexOf("cik");
    const nameIndex = fields.indexOf("name");
    const tickerIndex = fields.indexOf("ticker");
    const exchangeIndex = fields.indexOf("exchange");

    if (cikIndex < 0 || nameIndex < 0 || tickerIndex < 0) {
      throw new Error("SEC ticker mapping did not contain the expected fields.");
    }

    const byTicker = new Map<string, SecCompany>();

    for (const row of payload.data ?? []) {
      const cik = safeNumber(row[cikIndex]);
      const companyName = safeText(row[nameIndex]);
      const ticker = safeText(row[tickerIndex])?.toUpperCase() ?? null;
      const exchange = exchangeIndex >= 0 ? safeText(row[exchangeIndex]) : null;

      if (cik === null || !companyName || !ticker) {
        continue;
      }

      byTicker.set(ticker, {
        ticker,
        cik,
        cikPadded: paddedCik(cik),
        companyName,
        exchange,
        sourceUrl,
      });
    }

    this.tickerCache = {
      expiresAt: Date.now() + TICKER_MAP_TTL_MS,
      byTicker,
    };

    return byTicker;
  }

  public async getCompany(symbol: string): Promise<SecCompany> {
    const normalized = normalizeSymbol(symbol);
    const company = (await this.loadTickerMap()).get(normalized);

    if (!company) {
      throw new SecCompanyNotFoundError(normalized);
    }

    return company;
  }

  public async getRecentFilings(
    symbol: string,
    limit = 10,
  ): Promise<readonly SecFilingSummary[]> {
    const company = await this.getCompany(symbol);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
    const submissionsUrl = `${SEC_DATA_BASE_URL}/submissions/CIK${company.cikPadded}.json`;
    const payload = await this.requestJson<SecSubmissionsResponse>(submissionsUrl);
    const recent = payload.filings?.recent;

    if (!recent) {
      return [];
    }

    const accessionNumbers = recent.accessionNumber ?? [];
    const results: SecFilingSummary[] = [];

    for (let index = 0; index < accessionNumbers.length && results.length < safeLimit; index += 1) {
      const accessionNumber = safeText(accessionNumbers[index]);
      const filingDate = safeText(recent.filingDate?.[index]);
      const form = safeText(recent.form?.[index]);
      const primaryDocument = safeText(recent.primaryDocument?.[index]);

      if (!accessionNumber || !filingDate || !form || !primaryDocument) {
        continue;
      }

      results.push({
        ticker: company.ticker,
        cik: company.cik,
        companyName: payload.name?.trim() || company.companyName,
        accessionNumber,
        filingDate,
        reportDate: safeText(recent.reportDate?.[index]),
        acceptanceDateTime: safeText(recent.acceptanceDateTime?.[index]),
        form,
        fileNumber: safeText(recent.fileNumber?.[index]),
        primaryDocument,
        primaryDocumentUrl: filingDocumentUrl(company.cik, accessionNumber, primaryDocument),
      });
    }

    return results;
  }

  public async getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary> {
    const company = await this.getCompany(symbol);
    const sourceUrl = `${SEC_DATA_BASE_URL}/api/xbrl/companyfacts/CIK${company.cikPadded}.json`;
    const payload = await this.requestJson<SecCompanyFactsResponse>(sourceUrl);
    const selectedFacts: Record<string, SecFactSnapshot> = {};

    for (const definition of FACT_DEFINITIONS) {
      const taxonomyFacts = payload.facts?.[definition.taxonomy];
      if (!taxonomyFacts) {
        continue;
      }

      for (const tag of definition.tags) {
        const concept = taxonomyFacts[tag];
        if (!concept) {
          continue;
        }

        const fact = latestFact(definition.key, definition.taxonomy, tag, concept, company.cik);
        if (fact) {
          selectedFacts[definition.key] = fact;
          break;
        }
      }
    }

    return {
      ticker: company.ticker,
      cik: company.cik,
      companyName: payload.entityName?.trim() || company.companyName,
      retrievedAt: new Date().toISOString(),
      facts: Object.freeze(selectedFacts),
      sourceUrl,
      disclosure: SEC_DISCLOSURE,
    };
  }
}
