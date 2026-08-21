// TS: 2026-08-21 15:16 UTC

import pg from "pg";
import type { AppConfig } from "../config.js";
import {
  isProtectedCompany,
  PROTECTED_COMPANY_SQL_PREDICATE,
} from "../policy/protected-stocks.js";
import { ProviderNotConfiguredError } from "../providers/types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export const SEC_BATCH_CANDIDATE_ELIGIBILITY_SQL = `
  (
    cps.sec_status IN ('queued', 'partial', 'failed', 'stale')
    OR (
      ${PROTECTED_COMPANY_SQL_PREDICATE}
      AND cps.sec_status = 'unresolved'
      AND (
        cps.last_completed_at IS NULL
        OR cps.last_completed_at < now() - interval '24 hours'
      )
    )
  )
`;

export const CLEANUP_DUPLICATE_CIK_FAILURES_SQL = `
  UPDATE company_pipeline_status cps
  SET
    sec_status = 'unresolved',
    last_completed_at = now(),
    next_retry_at = NULL
  FROM companies c
  WHERE c.id = cps.company_id
    AND NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
    AND cps.sec_status = 'failed'
    AND cps.last_error IS NOT NULL
    AND cps.last_error ILIKE '%companies_sec_cik_unique%'
`;

export const PROMOTE_EXHAUSTED_FAILURES_SQL = `
  UPDATE company_pipeline_status cps
  SET
    sec_status = 'unresolved',
    last_completed_at = now(),
    next_retry_at = NULL
  FROM companies c
  WHERE c.id = cps.company_id
    AND c.is_active = true
    AND NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
    AND cps.sec_status = 'failed'
    AND cps.sec_attempt_count >= 3
`;

export const MARK_FAILED_SQL = `
  UPDATE company_pipeline_status cps
  SET
    sec_status = CASE
      WHEN NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
        AND cps.sec_attempt_count >= 3 THEN 'unresolved'
      ELSE 'failed'
    END,
    last_error = left($2, 1000),
    last_completed_at = CASE
      WHEN NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
        AND cps.sec_attempt_count >= 3 THEN now()
      ELSE cps.last_completed_at
    END,
    next_retry_at = CASE
      WHEN NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
        AND cps.sec_attempt_count >= 3 THEN NULL
      ELSE now() + make_interval(
        mins => LEAST(GREATEST(cps.sec_attempt_count, 1) * 15, 1440)
      )
    END
  FROM companies c
  WHERE c.id = cps.company_id AND c.ticker = $1
`;

export interface SecBatchCandidate {
  readonly ticker: string;
  readonly attemptCount: number;
  readonly isPilot: boolean;
  readonly isProtected: boolean;
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
  readonly is_pilot: boolean;
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

      await client.query(CLEANUP_DUPLICATE_CIK_FAILURES_SQL);
      await client.query(PROMOTE_EXHAUSTED_FAILURES_SQL);

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
          WITH replacement_budget AS (
            SELECT GREATEST(
              count(*) FILTER (
                WHERE NOT ${PROTECTED_COMPANY_SQL_PREDICATE}
                  AND cps.sec_status IN ('failed', 'unresolved')
              ) - count(*) FILTER (WHERE cps.replacement_attempted = true),
              0
            ) AS available
            FROM company_pipeline_status cps
            JOIN companies c ON c.id = cps.company_id
            WHERE c.is_active = true
          ),
          candidates AS (
            SELECT
              cps.company_id,
              CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END AS protected_priority,
              CASE cps.sec_status
                WHEN 'queued' THEN 0
                WHEN 'partial' THEN 1
                WHEN 'failed' THEN 2
                WHEN 'unresolved' THEN 3
                WHEN 'stale' THEN 4
                ELSE 5
              END AS state_priority,
              cps.sec_attempt_count,
              cps.updated_at,
              c.ticker
            FROM company_pipeline_status cps
            JOIN companies c ON c.id = cps.company_id
            WHERE c.is_active = true
              AND ${SEC_BATCH_CANDIDATE_ELIGIBILITY_SQL}
              AND (cps.next_retry_at IS NULL OR cps.next_retry_at <= now())
            ORDER BY
              CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END,
              CASE cps.sec_status
                WHEN 'queued' THEN 0
                WHEN 'partial' THEN 1
                WHEN 'failed' THEN 2
                WHEN 'unresolved' THEN 3
                WHEN 'stale' THEN 4
                ELSE 5
              END,
              cps.sec_attempt_count ASC,
              cps.updated_at ASC,
              c.ticker ASC
            FOR UPDATE OF cps SKIP LOCKED
            LIMIT $1
          ),
          ranked_candidates AS (
            SELECT
              candidates.company_id,
              row_number() OVER (
                ORDER BY
                  candidates.protected_priority,
                  candidates.state_priority,
                  candidates.sec_attempt_count,
                  candidates.updated_at,
                  candidates.ticker
              ) AS claim_order
            FROM candidates
          )
          UPDATE company_pipeline_status cps
          SET
            sec_status = 'processing',
            sec_attempt_count = cps.sec_attempt_count + 1,
            replacement_attempted = cps.replacement_attempted OR (
              cps.sec_attempt_count = 0
              AND ranked_candidates.claim_order <= replacement_budget.available
            ),
            last_started_at = now(),
            last_error = NULL,
            next_retry_at = NULL
          FROM ranked_candidates, replacement_budget, companies c
          WHERE cps.company_id = ranked_candidates.company_id
            AND c.id = cps.company_id
          RETURNING c.ticker, cps.sec_attempt_count, c.is_pilot
        `,
        [safeLimit],
      );

      await client.query("COMMIT");

      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            ticker: row.ticker,
            attemptCount: safeCount(row.sec_attempt_count),
            isPilot: row.is_pilot === true,
            isProtected: isProtectedCompany(row.ticker, row.is_pilot === true),
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
    await this.pool.query(MARK_FAILED_SQL, [ticker, message]);
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
