// TS: 2026-08-21 15:16 UTC

import pg, { type PoolClient } from "pg";
import type { AppConfig } from "../config.js";
import { ProviderNotConfiguredError, type QuoteSnapshot } from "../providers/types.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecFilingSummary,
} from "../sec/types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export interface StoredQuoteSnapshot {
  readonly provider: string;
  readonly price: number;
  readonly change: number | null;
  readonly percentChange: number | null;
  readonly volume: number | null;
  readonly marketSession: string;
  readonly freshness: string;
  readonly providerTimestamp: string;
  readonly retrievedAt: string;
  readonly feedDisclosure: string;
}

export interface StoredFilingSnapshot {
  readonly accessionNumber: string;
  readonly form: string;
  readonly filingDate: string;
  readonly reportDate: string | null;
  readonly acceptedAt: string | null;
  readonly primaryDocumentUrl: string;
}

export interface StoredCompanySnapshot {
  readonly ticker: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly currency: string;
  readonly secCik: string | null;
  readonly updatedAt: string;
  readonly latestQuote: StoredQuoteSnapshot | null;
  readonly latestFiling: StoredFilingSnapshot | null;
  readonly filingCount: number;
  readonly factCount: number;
  readonly ratingCount: number;
}

export interface PersistenceStore {
  readonly name: string;
  readonly configured: boolean;
  saveQuote(quote: QuoteSnapshot): Promise<void>;
  saveSecCompany(company: SecCompany): Promise<void>;
  saveSecFilings(company: SecCompany, filings: readonly SecFilingSummary[]): Promise<void>;
  saveSecFacts(summary: SecCompanyFactsSummary): Promise<void>;
  getStoredCompany(symbol: string): Promise<StoredCompanySnapshot | null>;
  close(): Promise<void>;
}

interface CompanyInput {
  readonly ticker: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly currency: string;
  readonly secCik: string | null;
}

interface StoredCompanyRow {
  readonly ticker: string;
  readonly company_name: string;
  readonly exchange: string | null;
  readonly currency: string;
  readonly sec_cik: string | null;
  readonly updated_at: Date | string;
  readonly quote_provider: string | null;
  readonly quote_price: string | number | null;
  readonly quote_change: string | number | null;
  readonly quote_percent_change: string | number | null;
  readonly quote_volume: string | number | null;
  readonly quote_market_session: string | null;
  readonly quote_freshness: string | null;
  readonly quote_provider_timestamp: Date | string | null;
  readonly quote_retrieved_at: Date | string | null;
  readonly quote_feed_disclosure: string | null;
  readonly filing_accession_number: string | null;
  readonly filing_form_type: string | null;
  readonly filing_date: Date | string | null;
  readonly filing_report_date: Date | string | null;
  readonly filing_accepted_at: Date | string | null;
  readonly filing_primary_document_url: string | null;
  readonly filing_count: string | number;
  readonly fact_count: string | number;
  readonly rating_count: string | number;
}

function isoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Database returned an invalid timestamp.");
  return date.toISOString();
}

function isoDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function nullableTimestamp(value: Date | string | null): string | null {
  return value === null ? null : isoTimestamp(value);
}

function nullableDate(value: Date | string | null): string | null {
  return value === null ? null : isoDate(value);
}

function nullableNumber(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function count(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function upsertCompany(client: PoolClient, input: CompanyInput): Promise<string> {
  const result = await client.query<{ id: string | number }>(
    `
      INSERT INTO companies (
        ticker,
        company_name,
        exchange,
        currency,
        sec_cik
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (ticker) DO UPDATE SET
        company_name = CASE
          WHEN EXCLUDED.company_name = EXCLUDED.ticker THEN companies.company_name
          ELSE EXCLUDED.company_name
        END,
        exchange = COALESCE(EXCLUDED.exchange, companies.exchange),
        currency = COALESCE(NULLIF(EXCLUDED.currency, ''), companies.currency),
        sec_cik = COALESCE(EXCLUDED.sec_cik, companies.sec_cik),
        is_active = true
      RETURNING id
    `,
    [
      input.ticker,
      input.companyName.trim() || input.ticker,
      input.exchange,
      input.currency.trim().toUpperCase().slice(0, 3) || "USD",
      input.secCik,
    ],
  );

  const id = result.rows[0]?.id;
  if (id === undefined) throw new Error(`Unable to save company ${input.ticker}.`);
  return String(id);
}

export class UnconfiguredPersistenceStore implements PersistenceStore {
  public readonly name = "unconfigured-database";
  public readonly configured = false;

  public async saveQuote(_quote: QuoteSnapshot): Promise<void> {}
  public async saveSecCompany(_company: SecCompany): Promise<void> {}
  public async saveSecFilings(
    _company: SecCompany,
    _filings: readonly SecFilingSummary[],
  ): Promise<void> {}
  public async saveSecFacts(_summary: SecCompanyFactsSummary): Promise<void> {}

  public async getStoredCompany(_symbol: string): Promise<StoredCompanySnapshot | null> {
    throw new ProviderNotConfiguredError("Database persistence provider");
  }

  public async close(): Promise<void> {}
}

export class PostgresPersistenceStore implements PersistenceStore {
  public readonly name = "postgresql";
  public readonly configured = true;
  private readonly pool: DatabasePool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  public async saveQuote(quote: QuoteSnapshot): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const companyId = await upsertCompany(client, {
        ticker: quote.symbol,
        companyName: quote.companyName ?? quote.symbol,
        exchange: quote.exchange,
        currency: quote.currency,
        secCik: null,
      });

      await client.query(
        `
          INSERT INTO quote_snapshots (
            company_id,
            provider,
            price,
            change_amount,
            percent_change,
            volume,
            market_session,
            freshness,
            provider_timestamp,
            retrieved_at,
            feed_disclosure
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (company_id, provider, provider_timestamp) DO UPDATE SET
            price = EXCLUDED.price,
            change_amount = EXCLUDED.change_amount,
            percent_change = EXCLUDED.percent_change,
            volume = EXCLUDED.volume,
            market_session = EXCLUDED.market_session,
            freshness = EXCLUDED.freshness,
            retrieved_at = GREATEST(quote_snapshots.retrieved_at, EXCLUDED.retrieved_at),
            feed_disclosure = EXCLUDED.feed_disclosure
        `,
        [
          companyId,
          quote.provider,
          quote.price,
          quote.change,
          quote.percentChange,
          quote.volume,
          quote.marketSession,
          quote.freshness,
          quote.providerTimestamp,
          quote.retrievedAt,
          quote.feedDisclosure,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async saveSecCompany(company: SecCompany): Promise<void> {
    const client = await this.pool.connect();
    try {
      await upsertCompany(client, {
        ticker: company.ticker,
        companyName: company.companyName,
        exchange: company.exchange,
        currency: "USD",
        secCik: company.cikPadded,
      });
    } finally {
      client.release();
    }
  }

  public async saveSecFilings(
    company: SecCompany,
    filings: readonly SecFilingSummary[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const companyId = await upsertCompany(client, {
        ticker: company.ticker,
        companyName: company.companyName,
        exchange: company.exchange,
        currency: "USD",
        secCik: company.cikPadded,
      });

      for (const filing of filings) {
        await client.query(
          `
            INSERT INTO sec_filings (
              company_id,
              accession_number,
              form_type,
              filing_date,
              report_date,
              accepted_at,
              primary_document,
              primary_document_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (company_id, accession_number) DO UPDATE SET
              form_type = EXCLUDED.form_type,
              filing_date = EXCLUDED.filing_date,
              report_date = EXCLUDED.report_date,
              accepted_at = EXCLUDED.accepted_at,
              primary_document = EXCLUDED.primary_document,
              primary_document_url = EXCLUDED.primary_document_url,
              retrieved_at = now()
          `,
          [
            companyId,
            filing.accessionNumber,
            filing.form,
            filing.filingDate,
            filing.reportDate,
            filing.acceptanceDateTime,
            filing.primaryDocument,
            filing.primaryDocumentUrl,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async saveSecFacts(summary: SecCompanyFactsSummary): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const companyId = await upsertCompany(client, {
        ticker: summary.ticker,
        companyName: summary.companyName,
        exchange: null,
        currency: "USD",
        secCik: String(summary.cik).padStart(10, "0"),
      });

      for (const fact of Object.values(summary.facts)) {
        await client.query(
          `
            INSERT INTO company_facts (
              company_id,
              taxonomy,
              concept,
              label,
              description,
              unit,
              value_numeric,
              period_start,
              period_end,
              fiscal_year,
              fiscal_period,
              form_type,
              filed_date,
              accession_number,
              source_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (
              company_id,
              taxonomy,
              concept,
              unit,
              period_start,
              period_end,
              fiscal_year,
              fiscal_period,
              form_type,
              accession_number
            ) DO UPDATE SET
              label = EXCLUDED.label,
              description = EXCLUDED.description,
              value_numeric = EXCLUDED.value_numeric,
              filed_date = EXCLUDED.filed_date,
              source_url = EXCLUDED.source_url,
              retrieved_at = now()
          `,
          [
            companyId,
            fact.taxonomy,
            fact.tag,
            fact.label,
            fact.description,
            fact.unit,
            fact.value,
            fact.periodStart,
            fact.periodEnd,
            fact.fiscalYear,
            fact.fiscalPeriod,
            fact.form,
            fact.filed,
            fact.accessionNumber,
            fact.sourceUrl,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getStoredCompany(symbol: string): Promise<StoredCompanySnapshot | null> {
    const result = await this.pool.query<StoredCompanyRow>(
      `
        SELECT
          c.ticker,
          c.company_name,
          c.exchange,
          c.currency,
          c.sec_cik,
          c.updated_at,
          q.provider AS quote_provider,
          q.price AS quote_price,
          q.change_amount AS quote_change,
          q.percent_change AS quote_percent_change,
          q.volume AS quote_volume,
          q.market_session AS quote_market_session,
          q.freshness AS quote_freshness,
          q.provider_timestamp AS quote_provider_timestamp,
          q.retrieved_at AS quote_retrieved_at,
          q.feed_disclosure AS quote_feed_disclosure,
          f.accession_number AS filing_accession_number,
          f.form_type AS filing_form_type,
          f.filing_date,
          f.report_date AS filing_report_date,
          f.accepted_at AS filing_accepted_at,
          f.primary_document_url AS filing_primary_document_url,
          (SELECT count(*) FROM sec_filings sf WHERE sf.company_id = c.id) AS filing_count,
          (SELECT count(*) FROM company_facts cf WHERE cf.company_id = c.id) AS fact_count,
          (SELECT count(*) FROM monster_rating_runs mr WHERE mr.company_id = c.id) AS rating_count
        FROM companies c
        LEFT JOIN LATERAL (
          SELECT *
          FROM quote_snapshots
          WHERE company_id = c.id
          ORDER BY provider_timestamp DESC, retrieved_at DESC
          LIMIT 1
        ) q ON true
        LEFT JOIN LATERAL (
          SELECT *
          FROM sec_filings
          WHERE company_id = c.id
          ORDER BY filing_date DESC, accepted_at DESC NULLS LAST
          LIMIT 1
        ) f ON true
        WHERE c.ticker = $1
        LIMIT 1
      `,
      [symbol],
    );

    const row = result.rows[0];
    if (!row) return null;

    const latestQuote =
      row.quote_provider &&
      row.quote_price !== null &&
      row.quote_market_session &&
      row.quote_freshness &&
      row.quote_provider_timestamp &&
      row.quote_retrieved_at &&
      row.quote_feed_disclosure
        ? Object.freeze({
            provider: row.quote_provider,
            price: Number(row.quote_price),
            change: nullableNumber(row.quote_change),
            percentChange: nullableNumber(row.quote_percent_change),
            volume: nullableNumber(row.quote_volume),
            marketSession: row.quote_market_session,
            freshness: row.quote_freshness,
            providerTimestamp: isoTimestamp(row.quote_provider_timestamp),
            retrievedAt: isoTimestamp(row.quote_retrieved_at),
            feedDisclosure: row.quote_feed_disclosure,
          })
        : null;

    const latestFiling =
      row.filing_accession_number &&
      row.filing_form_type &&
      row.filing_date &&
      row.filing_primary_document_url
        ? Object.freeze({
            accessionNumber: row.filing_accession_number,
            form: row.filing_form_type,
            filingDate: isoDate(row.filing_date),
            reportDate: nullableDate(row.filing_report_date),
            acceptedAt: nullableTimestamp(row.filing_accepted_at),
            primaryDocumentUrl: row.filing_primary_document_url,
          })
        : null;

    return Object.freeze({
      ticker: row.ticker,
      companyName: row.company_name,
      exchange: row.exchange,
      currency: row.currency,
      secCik: row.sec_cik,
      updatedAt: isoTimestamp(row.updated_at),
      latestQuote,
      latestFiling,
      filingCount: count(row.filing_count),
      factCount: count(row.fact_count),
      ratingCount: count(row.rating_count),
    });
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createPersistenceStore(config: AppConfig): PersistenceStore {
  return config.databaseUrl
    ? new PostgresPersistenceStore(config.databaseUrl)
    : new UnconfiguredPersistenceStore();
}
