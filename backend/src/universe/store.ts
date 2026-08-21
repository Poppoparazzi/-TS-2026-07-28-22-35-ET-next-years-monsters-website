// TS: 2026-08-21 15:16 UTC

import pg from "pg";
import type { AppConfig } from "../config.js";
import {
  isProtectedCompany,
  PROTECTED_COMPANY_SQL_PREDICATE,
  PROTECTED_STRATEGIC_TICKERS,
} from "../policy/protected-stocks.js";
import { ProviderNotConfiguredError } from "../providers/types.js";
import type {
  PipelineStatus,
  UniverseCompany,
  UniverseCompanyStatus,
  UniverseDirectoryCompany,
  UniverseDirectorySearch,
  UniverseDirectoryStatus,
  UniverseImportSummary,
  UniverseStatusSummary,
  UniverseStore,
} from "./types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export const DEACTIVATE_UNIVERSE_SQL = `
  UPDATE companies c
  SET is_active = false
  WHERE c.is_active = true
    AND NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
`;

export const UPSERT_UNIVERSE_COMPANY_SQL = `
  INSERT INTO companies (
    ticker,
    company_name,
    exchange,
    currency,
    sec_cik,
    is_active,
    updated_at
  )
  SELECT
    $1::varchar(15),
    $2::text,
    $3::text,
    'USD',
    $4::varchar(10),
    true,
    clock_timestamp()
  ON CONFLICT (ticker) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    exchange = COALESCE(EXCLUDED.exchange, companies.exchange),
    sec_cik = EXCLUDED.sec_cik,
    is_active = true,
    updated_at = EXCLUDED.updated_at
  RETURNING id
`;

interface UniverseStatusRow {
  readonly ticker: string;
  readonly company_name: string;
  readonly exchange: string | null;
  readonly sec_cik: string | null;
  readonly is_pilot: boolean;
  readonly replacement_attempted: boolean;
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

interface UniverseDirectoryRow {
  readonly ticker: string;
  readonly company_name: string;
  readonly exchange: string | null;
  readonly sec_cik: string | null;
  readonly is_pilot: boolean;
  readonly sec_status: PipelineStatus;
  readonly has_filings: boolean;
  readonly has_facts: boolean;
  readonly has_rating: boolean;
}

interface UniverseDirectoryCountRow {
  readonly universe_size: string | number;
  readonly sec_evidence_ready_count: string | number;
  readonly protected_present_count: string | number;
  readonly protected_incomplete_count: string | number;
  readonly replaceable_failure_count: string | number;
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

export function classifyUniverseDirectoryStatus(input: {
  readonly secEvidenceReady: boolean;
  readonly isProtected: boolean;
  readonly secStage: PipelineStatus;
}): UniverseDirectoryStatus {
  if (input.secEvidenceReady) return "evidence_ready";
  if (input.isProtected) return "protected_must_repair";
  if (input.secStage === "failed" || input.secStage === "unresolved") {
    return "replaceable_exception";
  }
  if (input.secStage === "processing") return "processing";
  return "reserve";
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

  public async searchCompanies(
    _query: string,
    _limit: number,
    _evidenceReadyOnly: boolean,
  ): Promise<UniverseDirectorySearch> {
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
      await client.query(DEACTIVATE_UNIVERSE_SQL);

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
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 5_000);
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
              COALESCE(cps.replacement_attempted, false) AS replacement_attempted,
              COALESCE(cps.sec_status, 'queued') AS sec_status,
              COALESCE(cps.sec_attempt_count, 0) AS sec_attempt_count,
              cps.last_error,
              cps.last_started_at,
              cps.last_completed_at,
              cps.next_retry_at,
              (c.sec_cik IS NOT NULL) AS has_sec_identity,
              EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id) AS has_filings,
              EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id) AS has_facts,
              EXISTS (SELECT 1 FROM quote_snapshots qs WHERE qs.company_id = c.id) AS has_quote,
              EXISTS (
                SELECT 1 FROM monster_rating_runs mr
                WHERE mr.company_id = c.id AND mr.status = 'complete'
              ) AS has_rating,
              c.updated_at
            FROM companies c
            LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
            WHERE c.is_active = true
            ORDER BY
              CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END,
              CASE WHEN COALESCE(cps.sec_status, 'queued') = 'complete' THEN 0 ELSE 1 END,
              c.updated_at ASC,
              c.ticker
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
          isProtected: isProtectedCompany(row.ticker, row.is_pilot),
          isReplacement: row.replacement_attempted,
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
      const processingCount = companies.filter((company) => company.secStage === "processing").length;
      const secCompleteCount = companies.filter((company) => company.secStage === "complete").length;
      const secEvidenceReadyCount = companies.filter(
        (company) =>
          company.secStage === "complete" &&
          company.hasSecIdentity &&
          company.hasFilings &&
          company.hasFacts,
      ).length;
      const candidatesExaminedCount = companies.filter(
        (company) => company.secAttemptCount > 0,
      ).length;
      const partialCount = companies.filter((company) => company.secStage === "partial").length;
      const failedCount = companies.filter((company) => company.secStage === "failed").length;
      const staleCount = companies.filter((company) => company.secStage === "stale").length;
      const unresolvedCount = companies.filter((company) => company.secStage === "unresolved").length;
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
      const protectedPresentTickers = new Set(
        companies
          .filter((company) => company.isProtected)
          .map((company) => company.ticker),
      );
      const protectedMissingTickers = PROTECTED_STRATEGIC_TICKERS.filter(
        (ticker) => !protectedPresentTickers.has(ticker),
      );
      const protectedMustRepairTickers = [
        ...protectedMissingTickers,
        ...companies
          .filter(
            (company) =>
              company.isProtected &&
              !(
                company.secStage === "complete" &&
                company.hasSecIdentity &&
                company.hasFilings &&
                company.hasFacts
              ),
          )
          .map((company) => company.ticker),
      ];
      const replaceableFailureTickers = companies
        .filter(
          (company) =>
            !company.isProtected &&
            (company.secStage === "failed" || company.secStage === "unresolved"),
        )
        .map((company) => company.ticker);
      const replacementsAttemptedCount = companies.filter(
        (company) => company.isReplacement,
      ).length;

      return Object.freeze({
        configured: true,
        generatedAt: new Date().toISOString(),
        requestedLimit: safeLimit,
        universeSize: Number(totalResult.rows[0]?.universe_size ?? 0),
        examinedCount: companies.length,
        candidatesExaminedCount,
        queuedCount,
        processingCount,
        secCompleteCount,
        secEvidenceReadyCount,
        partialCount,
        failedCount,
        staleCount,
        unresolvedCount,
        secIdentityCount,
        filingCompleteCount,
        factsCompleteCount,
        quoteCompleteCount,
        ratingCompleteCount,
        fullyCompleteCount,
        finalUsableUniverseCount: secEvidenceReadyCount,
        incompleteCount: companies.length - fullyCompleteCount,
        protectedTickerCount: PROTECTED_STRATEGIC_TICKERS.length,
        protectedPresentCount: protectedPresentTickers.size,
        protectedMissingCount: protectedMissingTickers.length,
        protectedMissingTickers: Object.freeze(protectedMissingTickers),
        protectedMustRepairCount: protectedMustRepairTickers.length,
        protectedMustRepairTickers: Object.freeze(protectedMustRepairTickers),
        replaceableFailureCount: replaceableFailureTickers.length,
        replaceableFailureTickers: Object.freeze(replaceableFailureTickers),
        replacementsAttemptedCount,
        reserveCandidatesRemainingCount: companies.length - candidatesExaminedCount,
        companies: Object.freeze(companies),
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async searchCompanies(
    query: string,
    limit: number,
    evidenceReadyOnly: boolean,
  ): Promise<UniverseDirectorySearch> {
    const normalizedQuery = query.trim().replace(/\s+/g, " ").slice(0, 100);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN READ ONLY");

      const evidenceReadySql = `
        COALESCE(cps.sec_status, 'queued') = 'complete'
        AND c.sec_cik IS NOT NULL
        AND EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id)
        AND EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id)
      `;
      const [countResult, companyResult] = await Promise.all([
        client.query<UniverseDirectoryCountRow>(
          `
            SELECT
              count(*) AS universe_size,
              count(*) FILTER (WHERE ${evidenceReadySql}) AS sec_evidence_ready_count,
              count(*) FILTER (WHERE ${PROTECTED_COMPANY_SQL_PREDICATE}) AS protected_present_count,
              count(*) FILTER (
                WHERE ${PROTECTED_COMPANY_SQL_PREDICATE}
                  AND NOT (${evidenceReadySql})
              ) AS protected_incomplete_count,
              count(*) FILTER (
                WHERE NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
                  AND COALESCE(cps.sec_status, 'queued') IN ('failed', 'unresolved')
              ) AS replaceable_failure_count
            FROM companies c
            LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
            WHERE c.is_active = true
          `,
        ),
        client.query<UniverseDirectoryRow>(
          `
            SELECT
              c.ticker,
              c.company_name,
              c.exchange,
              c.sec_cik,
              c.is_pilot,
              COALESCE(cps.sec_status, 'queued') AS sec_status,
              EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id) AS has_filings,
              EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id) AS has_facts,
              EXISTS (
                SELECT 1 FROM monster_rating_runs mr
                WHERE mr.company_id = c.id AND mr.status = 'complete'
              ) AS has_rating
            FROM companies c
            LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
            WHERE c.is_active = true
              AND $1::text <> ''
              AND (
                upper(c.ticker) = upper($1)
                OR position(upper($1) in upper(c.ticker)) = 1
                OR position(lower($1) in lower(c.company_name)) > 0
              )
              AND (
                $3::boolean = false
                OR (${evidenceReadySql})
              )
            ORDER BY
              CASE
                WHEN upper(c.ticker) = upper($1) THEN 0
                WHEN lower(c.company_name) = lower($1) THEN 1
                WHEN position(upper($1) in upper(c.ticker)) = 1 THEN 2
                WHEN position(lower($1) in lower(c.company_name)) = 1 THEN 3
                ELSE 4
              END,
              CASE WHEN ${evidenceReadySql} THEN 0 ELSE 1 END,
              c.ticker
            LIMIT $2
          `,
          [normalizedQuery, safeLimit, evidenceReadyOnly],
        ),
      ]);

      await client.query("COMMIT");

      const results = companyResult.rows.map<UniverseDirectoryCompany>((row) => {
        const secEvidenceReady =
          row.sec_status === "complete" &&
          row.sec_cik !== null &&
          row.has_filings &&
          row.has_facts;
        const isProtected = isProtectedCompany(row.ticker, row.is_pilot);
        const status = classifyUniverseDirectoryStatus({
          secEvidenceReady,
          isProtected,
          secStage: row.sec_status,
        });

        return Object.freeze({
          ticker: row.ticker,
          companyName: row.company_name,
          exchange: row.exchange,
          secCik: row.sec_cik,
          isProtected,
          secEvidenceReady,
          ratingAvailable: row.has_rating,
          status,
        });
      });
      const counts = countResult.rows[0];
      const protectedPresentCount = count(counts?.protected_present_count ?? 0);
      const protectedMissingCount = Math.max(
        PROTECTED_STRATEGIC_TICKERS.length - protectedPresentCount,
        0,
      );

      return Object.freeze({
        query: normalizedQuery,
        universeSize: count(counts?.universe_size ?? 0),
        secEvidenceReadyCount: count(counts?.sec_evidence_ready_count ?? 0),
        protectedTickerCount: PROTECTED_STRATEGIC_TICKERS.length,
        protectedMustRepairCount:
          count(counts?.protected_incomplete_count ?? 0) + protectedMissingCount,
        replaceableFailureCount: count(counts?.replaceable_failure_count ?? 0),
        results: Object.freeze(results),
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
