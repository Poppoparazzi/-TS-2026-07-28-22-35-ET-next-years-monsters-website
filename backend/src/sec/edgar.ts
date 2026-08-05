// TS: 2026-08-05 09:02 ET

import {
  parseSecFactHistory,
  type SecCompanyFactsPayload,
} from "./fact-history.js";
import {
  type SecCompany,
  type SecCompanyFactsSummary,
  type SecDataProvider,
  type SecFilingSummary,
  SecCompanyNotFoundError,
  SecEdgarRequestError,
} from "./types.js";

const SEC_FILES_BASE_URL = "https://www.sec.gov/files";
const SEC_DATA_BASE_URL = "https://data.sec.gov";
const SEC_ARCHIVES_BASE_URL = "https://www.sec.gov/Archives/edgar/data";
const TICKER_MAP_TTL_MS = 6 * 60 * 60 * 1_000;
const MIN_REQUEST_INTERVAL_MS = 125;
const SEC_DISCLOSURE =
  "Official SEC Evidence. SEC EDGAR submissions and XBRL company facts retain filing form, fiscal period, unit, dates, accession number, and source filing so context is not concealed.";

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

function filingDocumentUrl(
  cik: number,
  accessionNumber: string,
  primaryDocument: string,
): string {
  const folder = accessionNumber.replaceAll("-", "");
  return `${SEC_ARCHIVES_BASE_URL}/${cik}/${folder}/${encodeURIComponent(primaryDocument)}`;
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
    if (!userAgent.trim()) throw new Error("SEC user agent is required.");
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

      if (!response.ok) throw new SecEdgarRequestError(response.status);
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
      if (cik === null || !companyName || !ticker) continue;

      if (!byTicker.has(ticker)) {
        byTicker.set(
          ticker,
          Object.freeze({
            ticker,
            cik,
            cikPadded: paddedCik(cik),
            companyName,
            exchange,
            sourceUrl,
          }),
        );
      }
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
    if (!company) throw new SecCompanyNotFoundError(normalized);
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
    if (!recent) return Object.freeze([]);

    const accessionNumbers = recent.accessionNumber ?? [];
    const results: SecFilingSummary[] = [];
    for (let index = 0; index < accessionNumbers.length && results.length < safeLimit; index += 1) {
      const accessionNumber = safeText(accessionNumbers[index]);
      const filingDate = safeText(recent.filingDate?.[index]);
      const form = safeText(recent.form?.[index]);
      const primaryDocument = safeText(recent.primaryDocument?.[index]);
      if (!accessionNumber || !filingDate || !form || !primaryDocument) continue;

      results.push(
        Object.freeze({
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
          primaryDocumentUrl: filingDocumentUrl(
            company.cik,
            accessionNumber,
            primaryDocument,
          ),
        }),
      );
    }
    return Object.freeze(results);
  }

  public async getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary> {
    const company = await this.getCompany(symbol);
    const sourceUrl = `${SEC_DATA_BASE_URL}/api/xbrl/companyfacts/CIK${company.cikPadded}.json`;
    const payload = await this.requestJson<SecCompanyFactsPayload>(sourceUrl);
    const parsed = parseSecFactHistory(payload, company.cik);

    return Object.freeze({
      ticker: company.ticker,
      cik: company.cik,
      companyName: payload.entityName?.trim() || company.companyName,
      retrievedAt: new Date().toISOString(),
      facts: parsed.latest,
      factHistory: parsed.history,
      sourceUrl,
      disclosure: SEC_DISCLOSURE,
    });
  }
}
