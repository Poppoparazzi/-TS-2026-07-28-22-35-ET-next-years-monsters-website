// TS: 2026-08-18 04:02 ET

import pg from "pg";
import type { AppConfig } from "../config.js";
import { ProviderNotConfiguredError } from "../providers/types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export interface SecBatchCandidate {
  readonly ticker: string;
  readonly attemptCount: number;
}

export interface SecBatchQueue {
  readonly name: string;
  readonly configured: boolean;
  claim(limit: number, maxAgeHours: number): Promise<readonly SecBatchCandidate[]>;
  markComplete(ticker: string): Promise<void>;
  markFailed(ticker: string, message: string): Promise<void>;
  markUnresolved(ticker: string, message: string): Promise<void>;
  close(): Promise<void>;
}

interface ClaimedRow {
  readonly ticker: string;
  readonly sec_attempt_count: string | number;
}

function safeCount(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class UnconfiguredSecBatchQueue implements SecBatchQueue {
  public readonly name = "unconfigured-database";
  public readonly configured = false;

  public async claim(
    _limit: number,
    _maxAgeHours: number,
  ): Promise<readonly SecBatchCandidate[]> {
    throw new ProviderNotConfiguredError("SEC batch queue database");
  }

  public async markComplete(_ticker: string): Promise<void> {
    throw new ProviderNotConfiguredError("SEC batch queue database");
  }

  public async markFailed(_ticker: string, _message: string): Promise<void> {
    throw new ProviderNotConfiguredError("SEC batch queue database");
  }

  public async markUnresolved(_ticker: string, _message: string): Promise<void> {
    throw new ProviderNotConfiguredError("SEC batch queue database");
  }

  public async close(): Promise<void> {}
}

export class PostgresSecBatchQueue implements SecBatchQueue {
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

  public async claim(
    limit: number,
    maxAgeHours: number,
  ): Promise<readonly SecBatchCandidate[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
    const safeMaxAgeHours = Math.min(Math.max(Math.trunc(maxAgeHours), 1), 24 * 30);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(`
        INSERT INTO company_pipeline_status (
          company_id,
          sec_status,
          quote_status,
          rating_status
        )
        SELECT c.id, 'queued', 'unconfigured', 'blocked'
        FROM companies c
        WHERE c.is_active = true
        ON CONFLICT (company_id) DO NOTHING
      `);

      await client.query(`
        UPDATE company_pipeline_status
        SET
          sec_status = 'failed',
          last_error = 'Recovered an abandoned SEC processing job.',
          next_retry_at = now()
        WHERE sec_status = 'processing'
          AND last_started_at < now() - interval '30 minutes'
      `);

      await client.query(`
        UPDATE company_pipeline_status
        SET
          sec_status = 'unresolved',
          last_completed_at = now(),
          next_retry_at = NULL
        WHERE sec_status = 'failed'
          AND last_error LIKE '%duplicate key value violates unique constraint "companies_sec_cik_unique"%'
      `);

      await client.query(
        `
          UPDATE company_pipeline_status
          SET sec_status = 'stale'
          WHERE sec_status = 'complete'
            AND last_completed_at < now() - make_interval(hours => $1)
        `,
        [safeMaxAgeHours],
      );

      const result = await client.query<ClaimedRow>(
        `
          WITH candidates AS (
            SELECT cps.company_id
            FROM company_pipeline_status cps
            JOIN companies c ON c.id = cps.company_id
            WHERE c.is_active = true
              AND cps.sec_status IN ('queued', 'partial', 'failed', 'stale')
              AND (cps.next_retry_at IS NULL OR cps.next_retry_at <= now())
            ORDER BY
              c.is_pilot DESC,
              CASE cps.sec_status
                WHEN 'queued' THEN 0
                WHEN 'partial' THEN 1
                WHEN 'failed' THEN 2
                WHEN 'stale' THEN 3
                ELSE 4
              END,
              cps.sec_attempt_count ASC,
              cps.updated_at ASC,
              c.ticker ASC
            FOR UPDATE OF cps SKIP LOCKED
            LIMIT $1
          )
          UPDATE company_pipeline_status cps
          SET
            sec_status = 'processing',
            sec_attempt_count = cps.sec_attempt_count + 1,
            last_started_at = now(),
            last_error = NULL,
            next_retry_at = NULL
          FROM candidates, companies c
          WHERE cps.company_id = candidates.company_id
            AND c.id = cps.company_id
          RETURNING c.ticker, cps.sec_attempt_count
        `,
        [safeLimit],
      );

      await client.query("COMMIT");

      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            ticker: row.ticker,
            attemptCount: safeCount(row.sec_attempt_count),
          }),
        ),
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async markComplete(ticker: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE company_pipeline_status cps
        SET
          sec_status = 'complete',
          last_error = NULL,
          last_completed_at = now(),
          next_retry_at = NULL
        FROM companies c
        WHERE c.id = cps.company_id AND c.ticker = $1
      `,
      [ticker],
    );
  }

  public async markFailed(ticker: string, message: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE company_pipeline_status cps
        SET
          sec_status = 'failed',
          last_error = left($2, 1000),
          next_retry_at = now() + make_interval(
            mins => LEAST(GREATEST(cps.sec_attempt_count, 1) * 15, 1440)
          )
        FROM companies c
        WHERE c.id = cps.company_id AND c.ticker = $1
      `,
      [ticker, message],
    );
  }

  public async markUnresolved(ticker: string, message: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE company_pipeline_status cps
        SET
          sec_status = 'unresolved',
          last_error = left($2, 1000),
          last_completed_at = now(),
          next_retry_at = NULL
        FROM companies c
        WHERE c.id = cps.company_id AND c.ticker = $1
      `,
      [ticker, message],
    );
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createSecBatchQueue(config: AppConfig): SecBatchQueue {
  return config.databaseUrl
    ? new PostgresSecBatchQueue(config.databaseUrl)
    : new UnconfiguredSecBatchQueue();
}
