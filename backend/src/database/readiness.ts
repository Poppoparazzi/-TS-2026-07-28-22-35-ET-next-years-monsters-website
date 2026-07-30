// TS: 2026-07-29 21:47 ET

import pg from "pg";
import type { AppConfig } from "../config.js";
import { ProviderNotConfiguredError } from "../providers/types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export interface CompanyReadiness {
  readonly ticker: string;
  readonly companyName: string;
  readonly hasVerifiedQuote: boolean;
  readonly quoteIsUsable: boolean;
  readonly hasSecStatus: boolean;
  readonly hasSavedVersionedRating: boolean;
  readonly hasRatingEvidence: boolean;
  readonly isLiveReady: boolean;
  readonly lastSuccessfulUpdate: string | null;
}

export interface ReadinessGate {
  readonly requiredCompanyCount: number;
  readonly candidateCompanyCount: number;
  readonly readyCompanyCount: number;
  readonly pendingCompanyCount: number;
  readonly companiesStillToAdd: number;
  readonly companiesFailingChecks: number;
  readonly isLiveReady: boolean;
  readonly lastSuccessfulUpdate: string | null;
  readonly pendingTickers: readonly string[];
}

export interface RolloutReadinessSnapshot {
  readonly configured: true;
  readonly generatedAt: string;
  readonly pilot: ReadinessGate;
  readonly top25: ReadinessGate;
  readonly companies: readonly CompanyReadiness[];
}

export interface DatabaseReadinessProvider {
  readonly name: string;
  readonly configured: boolean;
  getSnapshot(): Promise<RolloutReadinessSnapshot>;
  close(): Promise<void>;
}

interface CompanyReadinessRow {
  readonly ticker: string;
  readonly company_name: string;
  readonly has_verified_quote: boolean;
  readonly quote_is_usable: boolean;
  readonly has_sec_status: boolean;
  readonly has_saved_versioned_rating: boolean;
  readonly has_rating_evidence: boolean;
  readonly is_live_ready: boolean;
  readonly last_successful_update: Date | string | null;
}

interface PilotGateRow {
  readonly required_company_count: string | number;
  readonly ready_company_count: string | number;
  readonly pending_company_count: string | number;
  readonly pilot_is_live_ready: boolean;
  readonly last_successful_update: Date | string | null;
  readonly pending_tickers: string[] | null;
}

interface Top25GateRow {
  readonly required_company_count: string | number;
  readonly candidate_company_count: string | number;
  readonly ready_company_count: string | number;
  readonly companies_still_to_add: string | number;
  readonly companies_failing_checks: string | number;
  readonly top_25_is_live_ready: boolean;
  readonly last_successful_update: Date | string | null;
  readonly pending_tickers: string[] | null;
}

function count(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoTimestamp(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pendingTickers(value: string[] | null): readonly string[] {
  return Object.freeze([...(value ?? [])].map((ticker) => ticker.toUpperCase()));
}

export class UnconfiguredDatabaseReadinessProvider implements DatabaseReadinessProvider {
  public readonly name = "unconfigured-database";
  public readonly configured = false;

  public async getSnapshot(): Promise<RolloutReadinessSnapshot> {
    throw new ProviderNotConfiguredError("Database readiness provider");
  }

  public async close(): Promise<void> {}
}

export class PostgresDatabaseReadinessProvider implements DatabaseReadinessProvider {
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

  public async getSnapshot(): Promise<RolloutReadinessSnapshot> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN READ ONLY");

      const [companyResult, pilotResult, top25Result] = await Promise.all([
        client.query<CompanyReadinessRow>(`
          SELECT
            ticker,
            company_name,
            has_verified_quote,
            quote_is_usable,
            has_sec_status,
            has_saved_versioned_rating,
            has_rating_evidence,
            is_live_ready,
            last_successful_update
          FROM company_live_readiness
          ORDER BY is_pilot DESC, ticker
        `),
        client.query<PilotGateRow>("SELECT * FROM pilot_live_gate"),
        client.query<Top25GateRow>("SELECT * FROM top_25_live_gate"),
      ]);

      await client.query("COMMIT");

      const pilotRow = pilotResult.rows[0];
      const top25Row = top25Result.rows[0];

      if (!pilotRow || !top25Row) {
        throw new Error("Database readiness views returned no gate records.");
      }

      const companies = companyResult.rows.map<CompanyReadiness>((row) =>
        Object.freeze({
          ticker: row.ticker,
          companyName: row.company_name,
          hasVerifiedQuote: row.has_verified_quote,
          quoteIsUsable: row.quote_is_usable,
          hasSecStatus: row.has_sec_status,
          hasSavedVersionedRating: row.has_saved_versioned_rating,
          hasRatingEvidence: row.has_rating_evidence,
          isLiveReady: row.is_live_ready,
          lastSuccessfulUpdate: isoTimestamp(row.last_successful_update),
        }),
      );

      return Object.freeze({
        configured: true,
        generatedAt: new Date().toISOString(),
        pilot: Object.freeze({
          requiredCompanyCount: count(pilotRow.required_company_count),
          candidateCompanyCount: count(pilotRow.required_company_count),
          readyCompanyCount: count(pilotRow.ready_company_count),
          pendingCompanyCount: count(pilotRow.pending_company_count),
          companiesStillToAdd: 0,
          companiesFailingChecks: count(pilotRow.pending_company_count),
          isLiveReady: pilotRow.pilot_is_live_ready,
          lastSuccessfulUpdate: isoTimestamp(pilotRow.last_successful_update),
          pendingTickers: pendingTickers(pilotRow.pending_tickers),
        }),
        top25: Object.freeze({
          requiredCompanyCount: count(top25Row.required_company_count),
          candidateCompanyCount: count(top25Row.candidate_company_count),
          readyCompanyCount: count(top25Row.ready_company_count),
          pendingCompanyCount:
            count(top25Row.companies_still_to_add) + count(top25Row.companies_failing_checks),
          companiesStillToAdd: count(top25Row.companies_still_to_add),
          companiesFailingChecks: count(top25Row.companies_failing_checks),
          isLiveReady: top25Row.top_25_is_live_ready,
          lastSuccessfulUpdate: isoTimestamp(top25Row.last_successful_update),
          pendingTickers: pendingTickers(top25Row.pending_tickers),
        }),
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

export function createDatabaseReadinessProvider(config: AppConfig): DatabaseReadinessProvider {
  return config.databaseUrl
    ? new PostgresDatabaseReadinessProvider(config.databaseUrl)
    : new UnconfiguredDatabaseReadinessProvider();
}
