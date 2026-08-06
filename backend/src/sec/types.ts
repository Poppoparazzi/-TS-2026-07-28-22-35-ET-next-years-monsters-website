// TS: 2026-08-05 08:56 ET

export interface SecCompany {
  readonly ticker: string;
  readonly cik: number;
  readonly cikPadded: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly sourceUrl: string;
}

export interface SecFilingSummary {
  readonly ticker: string;
  readonly cik: number;
  readonly companyName: string;
  readonly accessionNumber: string;
  readonly filingDate: string;
  readonly reportDate: string | null;
  readonly acceptanceDateTime: string | null;
  readonly form: string;
  readonly fileNumber: string | null;
  readonly primaryDocument: string;
  readonly primaryDocumentUrl: string;
}

export interface SecFactSnapshot {
  readonly key: string;
  readonly taxonomy: string;
  readonly tag: string;
  readonly label: string;
  readonly description: string;
  readonly unit: string;
  readonly value: number;
  readonly form: string;
  readonly fiscalYear: number | null;
  readonly fiscalPeriod: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string;
  readonly filed: string;
  readonly accessionNumber: string;
  readonly sourceUrl: string;
}

export interface SecCompanyFactsSummary {
  readonly ticker: string;
  readonly cik: number;
  readonly companyName: string;
  readonly retrievedAt: string;
  readonly facts: Readonly<Record<string, SecFactSnapshot>>;
  readonly factHistory: Readonly<Record<string, readonly SecFactSnapshot[]>>;
  readonly sourceUrl: string;
  readonly disclosure: string;
}

export interface SecDataProvider {
  readonly name: string;
  readonly configured: boolean;
  getCompany(symbol: string): Promise<SecCompany>;
  getRecentFilings(symbol: string, limit?: number): Promise<readonly SecFilingSummary[]>;
  getCompanyFacts(symbol: string): Promise<SecCompanyFactsSummary>;
}

export class SecCompanyNotFoundError extends Error {
  public readonly statusCode = 404;

  public constructor(symbol: string) {
    super(`No SEC company mapping was found for ${symbol}.`);
    this.name = "SecCompanyNotFoundError";
  }
}

export class SecEdgarRequestError extends Error {
  public constructor(public readonly statusCode: number) {
    super(`SEC EDGAR request failed with HTTP ${statusCode}.`);
    this.name = "SecEdgarRequestError";
  }
}
