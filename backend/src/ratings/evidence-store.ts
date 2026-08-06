// TS: 2026-08-05 09:28 ET

import pg from "pg";
import { ProviderNotConfiguredError, type DailyMarketHistory } from "../providers/types.js";
import type { SecCompanyFactsSummary, SecFactSnapshot } from "../sec/types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export interface CoverageCompany {
  readonly id: string;
  readonly symbol: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly securityType: string | null;
  readonly secCik: string | null;
  readonly secIdentityResolved: boolean;
}

export interface ProviderHealthInput {
  readonly providerType: "sec" | "market-data" | "database" | "rating-engine";
  readonly providerName: string;
  readonly configured: boolean;
  readonly status: "healthy" | "degraded" | "unconfigured" | "failed";
  readonly checkedAt: string;
  readonly latencyMs: number | null;
  readonly failureCode: string | null;
  readonly failureMessage: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RatingEvidenceStore {
  readonly name: string;
  readonly configured: boolean;
  getCoverageCompany(symbol: string): Promise<CoverageCompany | null>;
  listCoverageCompanies(limit?: number): Promise<readonly CoverageCompany[]>;
  saveSecFactHistory(summary: SecCompanyFactsSummary): Promise<number>;
  saveMarketHistory(history: DailyMarketHistory): Promise<number>;
  recordProviderHealth(input: ProviderHealthInput): Promise<void>;
  close(): Promise<void>;
}

function normalizeSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return normalized;
}

function flattenFactHistory(summary: SecCompanyFactsSummary): readonly SecFactSnapshot[] {
  const unique = new Map<string, SecFactSnapshot>();
  for (const snapshots of Object.values(summary.factHistory)) {
    for (const fact of snapshots) {
      const identity = [
        fact.taxonomy,
        fact.tag,
        fact.unit,
        fact.periodStart ?? "",
        fact.periodEnd,
        fact.fiscalYear ?? "",
        fact.fiscalPeriod ?? "",
        fact.form,
        fact.accessionNumber,
      ].join("|");
      if (!unique.has(identity)) unique.set(identity, fact);
    }
  }
  return Object.freeze([...unique.values()]);
}

export class UnconfiguredRatingEvidenceStore implements RatingEvidenceStore {
  public readonly name = "unconfigured-rating-evidence-store";
  public readonly configured = false;

  private unavailable(): never {
    throw new ProviderNotConfiguredError("Production rating evidence database");
  }

  public async getCoverageCompany(_symbol: string): Promise<CoverageCompany | null> {
    return this.unavailable();
  }

  public async listCoverageCompanies(_limit = 2_000): Promise<readonly CoverageCompany[]> {
    return this.unavailable();
  }

  public async saveSecFactHistory(_summary: SecCompanyFactsSummary): Promise<number> {
    return this.unavailable();
  }

  public async saveMarketHistory(_history: DailyMarketHistory): Promise<number> {
    return this.unavailable();
  }

  public async recordProviderHealth(_input: ProviderHealthInput): Promise<void> {
    return this.unavailable();
  }

  public async close(): Promise<void> {}
}

export class PostgresRatingEvidenceStore implements RatingEvidenceStore {
  public readonly name = "postgresql-rating-evidence-store";
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

  private async companyId(symbol: string): Promise<string> {
    const result = await this.pool.query<{ id: string | number }>(
      "SELECT id FROM companies WHERE ticker = $1 AND is_active = true",
      [normalizeSymbol(symbol)],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error(`Active coverage company ${symbol} was not found.`);
    return String(id);
  }

  public async getCoverageCompany(symbol: string): Promise<CoverageCompany | null> {
    const result = await this.pool.query<{
      id: string | number;
      ticker: string;
      company_name: string;
      exchange: string | null;
      security_type: string | null;
      sec_cik: string | null;
      sec_status: string | null;
    }>(
      `
        SELECT
          c.id,
          c.ticker,
          c.company_name,
          c.exchange,
          c.security_type,
          c.sec_cik,
          cps.sec_status
        FROM companies c
        LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
        WHERE c.ticker = $1 AND c.is_active = true
        LIMIT 1
      `,
      [normalizeSymbol(symbol)],
    );
    const row = result.rows[0];
    if (!row) return null;
    return Object.freeze({
      id: String(row.id),
      symbol: row.ticker,
      companyName: row.company_name,
      exchange: row.exchange,
      securityType: row.security_type,
      secCik: row.sec_cik,
      secIdentityResolved: Boolean(row.sec_cik) && row.sec_status === "complete",
    });
  }

  public async listCoverageCompanies(limit = 2_000): Promise<readonly CoverageCompany[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 2_500);
    const result = await this.pool.query<{
      id: string | number;
      ticker: string;
      company_name: string;
      exchange: string | null;
      security_type: string | null;
      sec_cik: string | null;
      sec_status: string | null;
    }>(
      `
        SELECT
          c.id,
          c.ticker,
          c.company_name,
          c.exchange,
          c.security_type,
          c.sec_cik,
          cps.sec_status
        FROM companies c
        LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
        WHERE c.is_active = true
        ORDER BY c.is_pilot DESC, c.ticker
        LIMIT $1
      `,
      [safeLimit],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          id: String(row.id),
          symbol: row.ticker,
          companyName: row.company_name,
          exchange: row.exchange,
          securityType: row.security_type,
          secCik: row.sec_cik,
          secIdentityResolved: Boolean(row.sec_cik) && row.sec_status === "complete",
        }),
      ),
    );
  }

  public async saveSecFactHistory(summary: SecCompanyFactsSummary): Promise<number> {
    const companyId = await this.companyId(summary.ticker);
    const facts = flattenFactHistory(summary);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const fact of facts) {
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
      return facts.length;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async saveMarketHistory(history: DailyMarketHistory): Promise<number> {
    const companyId = await this.companyId(history.symbol);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const bar of history.bars) {
        await client.query(
          `
            INSERT INTO market_daily_bars (
              company_id,
              provider,
              bar_date,
              open_price,
              high_price,
              low_price,
              close_price,
              volume,
              retrieved_at,
              feed_disclosure
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (company_id, provider, bar_date) DO UPDATE SET
              open_price = EXCLUDED.open_price,
              high_price = EXCLUDED.high_price,
              low_price = EXCLUDED.low_price,
              close_price = EXCLUDED.close_price,
              volume = EXCLUDED.volume,
              retrieved_at = EXCLUDED.retrieved_at,
              feed_disclosure = EXCLUDED.feed_disclosure
          `,
          [
            companyId,
            history.provider,
            bar.date,
            bar.open,
            bar.high,
            bar.low,
            bar.close,
            bar.volume,
            history.retrievedAt,
            history.feedDisclosure,
          ],
        );
      }
      await client.query("COMMIT");
      return history.bars.length;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async recordProviderHealth(input: ProviderHealthInput): Promise<void> {
    await this.pool.query(
      `
        INSERT INTO provider_health_snapshots (
          provider_type,
          provider_name,
          configured,
          status,
          checked_at,
          latency_ms,
          failure_code,
          failure_message,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      `,
      [
        input.providerType,
        input.providerName,
        input.configured,
        input.status,
        input.checkedAt,
        input.latencyMs,
        input.failureCode,
        input.failureMessage,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createRatingEvidenceStore(databaseUrl: string | null): RatingEvidenceStore {
  return databaseUrl
    ? new PostgresRatingEvidenceStore(databaseUrl)
    : new UnconfiguredRatingEvidenceStore();
}
