// TS: 2026-08-02 15:34 ET

import pg from "pg";
import type { AppConfig } from "../config.js";
import { ProviderNotConfiguredError } from "../providers/types.js";
import type {
  PipelineStatus,
  UniverseCompany,
  UniverseCompanyStatus,
  UniverseImportSummary,
  UniverseStatusSummary,
  UniverseStore,
} from "./types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export const UPSERT_UNIVERSE_COMPANY_SQL = `
  INSERT INTO companies (
    ticker,
    company_name,
    exchange,
    currency,
    sec_cik,
    is_active
  )
  SELECT
    $1::varchar(15),
    $2::text,
    $3::text,
    'USD',
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM companies existing
        WHERE existing.sec_cik = $4::varchar(10)
          AND existing.ticker <> $1::varchar(15)
      ) THEN NULL::varchar(10)
      ELSE $4::varchar(10)
    END,
    true
  ON CONFLICT (ticker) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    exchange = COALESCE(EXCLUDED.exchange, companies.exchange),
    sec_cik = COALESCE(EXCLUDED.sec_cik, companies.sec_cik),
    is_active = true
  RETURNING id
`;

interface UniverseStatusRow {
  readonly ticker: string;
  readonly company_name: string;
  readonly exchange: string | null;
  readonly sec_cik: string | null;
  readonly is_pilot: boolean;
  readonly sec_status: PipelineStatus;
  readonly sec_attempt_count: string | number;
  readonly last_error: string | null;
  readonly last_started_at: Date | string | null;
  readonly last_completed_at: Date | string | null;
  readonly next_retry_at: Date | string | null;
  readonly has_sec_identity: boolean;
  readonly has_filings: boolean;
  readonly has_facts: boolean;
  readonly has_quote: boolean;
  readonly has_rating: boolean;
  readonly updated_at: Date | string;
}

function isoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Database returned an invalid timestamp.");
  return date.toISOString();
}

function nullableTimestamp(value: Date | string | null): string | null {
  return value === null ? null : isoTimestamp(value);
}

function count(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class UnconfiguredUniverseStore implements UniverseStore {
  public readonly name = "unconfigured-database";
  public readonly configured = false;

  public async importCompanies(
    _companies: readonly UniverseCompany[],
  ): Promise<UniverseImportSummary> {
    throw new ProviderNotConfiguredError("Bulk universe database");
  }

  public async getStatus(_limit: number): Promise<UniverseStatusSummary> {
    throw new ProviderNotConfiguredError("Bulk universe database");
  }

  public async close(): Promise<void> {}
}

export class PostgresUniverseStore implements UniverseStore {
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

  public async importCompanies(
    companies: readonly UniverseCompany[],
  ): Promise<UniverseImportSummary> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      for (const company of companies) {
        const companyResult = await client.query<{ id: string | number }>(
          UPSERT_UNIVERSE_COMPANY_SQL,
          [company.ticker, company.companyName, company.exchange, company.cikPadded],
        );

        const companyId = companyResult.rows[0]?.id;
        if (companyId === undefined) {
          throw new Error(`Unable to import universe company ${company.ticker}.`);
        }

        await client.query(
          `
            INSERT INTO company_pipeline_status (
              company_id,
              sec_status,
              quote_status,
              rating_status
            )
            VALUES ($1, 'queued', 'unconfigured', 'blocked')
            ON CONFLICT (company_id) DO NOTHING
          `,
          [companyId],
        );
      }

      await client.query("COMMIT");

      return Object.freeze({
        requestedCount: companies.length,
        importedCount: companies.length,
        database: this.name,
        sourceUrl: companies[0]?.sourceUrl ?? "SEC universe source unavailable",
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getStatus(limit: number): Promise<UniverseStatusSummary> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 2_500);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN READ ONLY");

      const [totalResult, companyResult] = await Promise.all([
        client.query<{ universe_size: string | number }>(
          "SELECT count(*) AS universe_size FROM companies WHERE is_active = true",
        ),
        client.query<UniverseStatusRow>(
          `
            SELECT
              c.ticker,
              c.company_name,
              c.exchange,
              c.sec_cik,
              c.is_pilot,
              COALESCE(cps.sec_status, 'queued') AS sec_status,
              COALESCE(cps.sec_attempt_count, 0) AS sec_attempt_count,
              cps.last_error,
              cps.last_started_at,
              cps.last_completed_at,
              cps.next_retry_at,
              (c.sec_cik IS NOT NULL) AS has_sec_identity,
              EXISTS (
                SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id
              ) AS has_filings,
              EXISTS (
                SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id
              ) AS has_facts,
              EXISTS (
                SELECT 1 FROM quote_snapshots qs WHERE qs.company_id = c.id
              ) AS has_quote,
              EXISTS (
                SELECT 1
                FROM monster_rating_runs mr
                WHERE mr.company_id = c.id AND mr.status = 'complete'
              ) AS has_rating,
              c.updated_at
            FROM companies c
            LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
            WHERE c.is_active = true
            ORDER BY c.is_pilot DESC, c.ticker
            LIMIT $1
          `,
          [safeLimit],
        ),
      ]);

      await client.query("COMMIT");

      const companies = companyResult.rows.map<UniverseCompanyStatus>((row) =>
        Object.freeze({
          ticker: row.ticker,
          companyName: row.company_name,
          exchange: row.exchange,
          secCik: row.sec_cik,
          isPilot: row.is_pilot,
          secStage: row.sec_status,
          secAttemptCount: count(row.sec_attempt_count),
          lastError: row.last_error,
          lastStartedAt: nullableTimestamp(row.last_started_at),
          lastCompletedAt: nullableTimestamp(row.last_completed_at),
          nextRetryAt: nullableTimestamp(row.next_retry_at),
          hasSecIdentity: row.has_sec_identity,
          hasFilings: row.has_filings,
          hasFacts: row.has_facts,
          hasQuote: row.has_quote,
          hasRating: row.has_rating,
          updatedAt: isoTimestamp(row.updated_at),
        }),
      );

      const queuedCount = companies.filter((company) => company.secStage === "queued").length;
      const processingCount = companies.filter(
        (company) => company.secStage === "processing",
      ).length;
      const secCompleteCount = companies.filter(
        (company) => company.secStage === "complete",
      ).length;
      const partialCount = companies.filter((company) => company.secStage === "partial").length;
      const failedCount = companies.filter((company) => company.secStage === "failed").length;
      const staleCount = companies.filter((company) => company.secStage === "stale").length;
      const secIdentityCount = companies.filter((company) => company.hasSecIdentity).length;
      const filingCompleteCount = companies.filter((company) => company.hasFilings).length;
      const factsCompleteCount = companies.filter((company) => company.hasFacts).length;
      const quoteCompleteCount = companies.filter((company) => company.hasQuote).length;
      const ratingCompleteCount = companies.filter((company) => company.hasRating).length;
      const fullyCompleteCount = companies.filter(
        (company) =>
          company.hasSecIdentity &&
          company.hasFilings &&
          company.hasFacts &&
          company.hasQuote &&
          company.hasRating,
      ).length;

      return Object.freeze({
        configured: true,
        generatedAt: new Date().toISOString(),
        requestedLimit: safeLimit,
        universeSize: Number(totalResult.rows[0]?.universe_size ?? 0),
        examinedCount: companies.length,
        queuedCount,
        processingCount,
        secCompleteCount,
        partialCount,
        failedCount,
        staleCount,
        secIdentityCount,
        filingCompleteCount,
        factsCompleteCount,
        quoteCompleteCount,
        ratingCompleteCount,
        fullyCompleteCount,
        incompleteCount: companies.length - fullyCompleteCount,
        companies: Object.freeze(companies),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createUniverseStore(config: AppConfig): UniverseStore {
  return config.databaseUrl
    ? new PostgresUniverseStore(config.databaseUrl)
    : new UnconfiguredUniverseStore();
}
