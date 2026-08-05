// TS: 2026-08-05 09:58 ET

import pg from "pg";
import { ProviderNotConfiguredError } from "../providers/types.js";
import type { CoverageCompany } from "./evidence-store.js";
import type { RatingCalculationOutcome, ProductionRatingService } from "./service.js";
import { MONSTER_RATING_ENGINE_VERSION } from "./spec-v1.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export type RatingBatchStatus =
  | "pending"
  | "running"
  | "completed"
  | "partial"
  | "cancelled"
  | "failed";

export interface RatingBatchSnapshot {
  readonly id: string;
  readonly engineVersion: string;
  readonly status: RatingBatchStatus;
  readonly requestedCount: number;
  readonly claimedCount: number;
  readonly ratedCount: number;
  readonly unratedCount: number;
  readonly failedCount: number;
  readonly pendingCount: number;
  readonly processingCount: number;
  readonly cancelledCount: number;
  readonly concurrency: number;
  readonly cancellationRequested: boolean;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly heartbeatAt: string | null;
  readonly nextRetryAt: string | null;
  readonly failureSummary: string | null;
}

export interface RatingBatchWorkItem {
  readonly id: string;
  readonly batchRunId: string;
  readonly attemptCount: number;
  readonly company: CoverageCompany;
}

export interface RatingBatchStore {
  readonly name: string;
  readonly configured: boolean;
  createBatch(
    companies: readonly CoverageCompany[],
    concurrency: number,
    engineVersion?: string,
  ): Promise<RatingBatchSnapshot>;
  claimWork(
    batchRunId: string,
    limit: number,
    now: string,
    staleAfterMinutes?: number,
  ): Promise<readonly RatingBatchWorkItem[]>;
  completeWork(item: RatingBatchWorkItem, outcome: RatingCalculationOutcome, now: string): Promise<void>;
  retryWork(item: RatingBatchWorkItem, error: string, nextRetryAt: string, now: string): Promise<void>;
  failWork(item: RatingBatchWorkItem, error: string, now: string): Promise<void>;
  requestCancellation(batchRunId: string, now: string): Promise<RatingBatchSnapshot>;
  heartbeat(batchRunId: string, now: string): Promise<void>;
  finalize(batchRunId: string, now: string): Promise<RatingBatchSnapshot>;
  getBatch(batchRunId: string): Promise<RatingBatchSnapshot>;
  close(): Promise<void>;
}

function integer(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface BatchSnapshotRow {
  readonly id: string | number;
  readonly engine_version: string;
  readonly status: RatingBatchStatus;
  readonly requested_count: string | number;
  readonly claimed_count: string | number;
  readonly rated_count: string | number;
  readonly unrated_count: string | number;
  readonly failed_count: string | number;
  readonly concurrency: string | number;
  readonly cancellation_requested: boolean;
  readonly started_at: Date | string | null;
  readonly completed_at: Date | string | null;
  readonly heartbeat_at: Date | string | null;
  readonly failure_summary: string | null;
  readonly pending_count: string | number;
  readonly processing_count: string | number;
  readonly cancelled_count: string | number;
  readonly next_retry_at: Date | string | null;
}

function snapshot(row: BatchSnapshotRow): RatingBatchSnapshot {
  return Object.freeze({
    id: String(row.id),
    engineVersion: row.engine_version,
    status: row.status,
    requestedCount: integer(row.requested_count),
    claimedCount: integer(row.claimed_count),
    ratedCount: integer(row.rated_count),
    unratedCount: integer(row.unrated_count),
    failedCount: integer(row.failed_count),
    pendingCount: integer(row.pending_count),
    processingCount: integer(row.processing_count),
    cancelledCount: integer(row.cancelled_count),
    concurrency: integer(row.concurrency),
    cancellationRequested: row.cancellation_requested,
    startedAt: iso(row.started_at),
    completedAt: iso(row.completed_at),
    heartbeatAt: iso(row.heartbeat_at),
    nextRetryAt: iso(row.next_retry_at),
    failureSummary: row.failure_summary,
  });
}

export class UnconfiguredRatingBatchStore implements RatingBatchStore {
  public readonly name = "unconfigured-rating-batch-store";
  public readonly configured = false;

  private unavailable(): never {
    throw new ProviderNotConfiguredError("Production rating batch database");
  }

  public async createBatch(
    _companies: readonly CoverageCompany[],
    _concurrency: number,
    _engineVersion = MONSTER_RATING_ENGINE_VERSION,
  ): Promise<RatingBatchSnapshot> {
    return this.unavailable();
  }

  public async claimWork(
    _batchRunId: string,
    _limit: number,
    _now: string,
    _staleAfterMinutes = 30,
  ): Promise<readonly RatingBatchWorkItem[]> {
    return this.unavailable();
  }

  public async completeWork(
    _item: RatingBatchWorkItem,
    _outcome: RatingCalculationOutcome,
    _now: string,
  ): Promise<void> {
    return this.unavailable();
  }

  public async retryWork(
    _item: RatingBatchWorkItem,
    _error: string,
    _nextRetryAt: string,
    _now: string,
  ): Promise<void> {
    return this.unavailable();
  }

  public async failWork(
    _item: RatingBatchWorkItem,
    _error: string,
    _now: string,
  ): Promise<void> {
    return this.unavailable();
  }

  public async requestCancellation(
    _batchRunId: string,
    _now: string,
  ): Promise<RatingBatchSnapshot> {
    return this.unavailable();
  }

  public async heartbeat(_batchRunId: string, _now: string): Promise<void> {
    return this.unavailable();
  }

  public async finalize(_batchRunId: string, _now: string): Promise<RatingBatchSnapshot> {
    return this.unavailable();
  }

  public async getBatch(_batchRunId: string): Promise<RatingBatchSnapshot> {
    return this.unavailable();
  }

  public async close(): Promise<void> {}
}

export class PostgresRatingBatchStore implements RatingBatchStore {
  public readonly name = "postgresql-rating-batch-store";
  public readonly configured = true;
  private readonly pool: DatabasePool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  private async reconcile(batchRunId: string, now: string): Promise<void> {
    await this.pool.query(
      `
        UPDATE rating_batch_runs rbr
        SET claimed_count = counts.claimed_count,
            rated_count = counts.rated_count,
            unrated_count = counts.unrated_count,
            failed_count = counts.failed_count,
            heartbeat_at = $2
        FROM (
          SELECT
            count(*) FILTER (WHERE started_at IS NOT NULL) AS claimed_count,
            count(*) FILTER (WHERE status = 'rated') AS rated_count,
            count(*) FILTER (WHERE status = 'unrated') AS unrated_count,
            count(*) FILTER (WHERE status = 'failed') AS failed_count
          FROM rating_batch_items
          WHERE batch_run_id = $1
        ) counts
        WHERE rbr.id = $1
      `,
      [batchRunId, now],
    );
  }

  public async createBatch(
    companies: readonly CoverageCompany[],
    concurrency: number,
    engineVersion = MONSTER_RATING_ENGINE_VERSION,
  ): Promise<RatingBatchSnapshot> {
    if (companies.length === 0) throw new Error("A rating batch requires at least one company.");
    const safeConcurrency = Math.min(Math.max(Math.trunc(concurrency), 1), 20);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const active = await client.query<{ id: string | number }>(
        `
          SELECT id
          FROM rating_batch_runs
          WHERE status IN ('pending', 'running')
          ORDER BY created_at DESC
          LIMIT 1
          FOR UPDATE
        `,
      );
      if (active.rows[0]) {
        throw new Error(`Rating batch ${active.rows[0].id} is already active.`);
      }
      const run = await client.query<{ id: string | number }>(
        `
          INSERT INTO rating_batch_runs (
            engine_version,
            status,
            requested_count,
            concurrency,
            started_at,
            heartbeat_at,
            metadata
          )
          VALUES ($1, 'running', $2, $3, now(), now(), $4::jsonb)
          RETURNING id
        `,
        [
          engineVersion,
          companies.length,
          safeConcurrency,
          JSON.stringify({ source: "active-coverage-universe" }),
        ],
      );
      const batchRunId = run.rows[0]?.id;
      if (batchRunId === undefined) throw new Error("Unable to create rating batch run.");

      for (const company of companies) {
        await client.query(
          `
            INSERT INTO rating_batch_items (batch_run_id, company_id, status)
            VALUES ($1, $2, 'pending')
            ON CONFLICT (batch_run_id, company_id) DO NOTHING
          `,
          [batchRunId, company.id],
        );
      }
      await client.query("COMMIT");
      return this.getBatch(String(batchRunId));
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async claimWork(
    batchRunId: string,
    limit: number,
    now: string,
    staleAfterMinutes = 30,
  ): Promise<readonly RatingBatchWorkItem[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const safeStaleMinutes = Math.min(Math.max(Math.trunc(staleAfterMinutes), 5), 24 * 60);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const run = await client.query<{
        status: RatingBatchStatus;
        cancellation_requested: boolean;
      }>(
        "SELECT status, cancellation_requested FROM rating_batch_runs WHERE id = $1 FOR UPDATE",
        [batchRunId],
      );
      const current = run.rows[0];
      if (!current) throw new Error(`Rating batch ${batchRunId} was not found.`);
      if (current.status !== "running" || current.cancellation_requested) {
        await client.query("COMMIT");
        return Object.freeze([]);
      }

      await client.query(
        `
          UPDATE rating_batch_items
          SET status = 'pending',
              next_retry_at = $2,
              last_error = COALESCE(last_error, 'Recovered stale processing claim.'),
              updated_at = $2
          WHERE batch_run_id = $1
            AND status = 'processing'
            AND updated_at < $2::timestamptz - make_interval(mins => $3)
        `,
        [batchRunId, now, safeStaleMinutes],
      );

      const selected = await client.query<{
        id: string | number;
        attempt_count: string | number;
        company_id: string | number;
        ticker: string;
        company_name: string;
        exchange: string | null;
        security_type: string | null;
        sec_cik: string | null;
        sec_status: string | null;
      }>(
        `
          SELECT
            rbi.id,
            rbi.attempt_count,
            c.id AS company_id,
            c.ticker,
            c.company_name,
            c.exchange,
            c.security_type,
            c.sec_cik,
            cps.sec_status
          FROM rating_batch_items rbi
          JOIN companies c ON c.id = rbi.company_id
          LEFT JOIN company_pipeline_status cps ON cps.company_id = c.id
          WHERE rbi.batch_run_id = $1
            AND rbi.status = 'pending'
            AND (rbi.next_retry_at IS NULL OR rbi.next_retry_at <= $2)
          ORDER BY rbi.id
          LIMIT $3
          FOR UPDATE OF rbi SKIP LOCKED
        `,
        [batchRunId, now, safeLimit],
      );
      if (selected.rows.length === 0) {
        await client.query("COMMIT");
        return Object.freeze([]);
      }

      const ids = selected.rows.map((row) => row.id);
      await client.query(
        `
          UPDATE rating_batch_items
          SET status = 'processing',
              attempt_count = attempt_count + 1,
              started_at = COALESCE(started_at, $2),
              next_retry_at = NULL,
              last_error = NULL,
              updated_at = $2
          WHERE id = ANY($1::bigint[])
        `,
        [ids, now],
      );
      await client.query(
        `
          UPDATE rating_batch_runs
          SET claimed_count = (
                SELECT count(*) FROM rating_batch_items
                WHERE batch_run_id = $1 AND started_at IS NOT NULL
              ),
              heartbeat_at = $2
          WHERE id = $1
        `,
        [batchRunId, now],
      );
      await client.query("COMMIT");

      return Object.freeze(
        selected.rows.map((row) =>
          Object.freeze({
            id: String(row.id),
            batchRunId,
            attemptCount: integer(row.attempt_count) + 1,
            company: Object.freeze({
              id: String(row.company_id),
              symbol: row.ticker,
              companyName: row.company_name,
              exchange: row.exchange,
              securityType: row.security_type,
              secCik: row.sec_cik,
              secIdentityResolved: Boolean(row.sec_cik) && row.sec_status === "complete",
            }),
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

  public async completeWork(
    item: RatingBatchWorkItem,
    outcome: RatingCalculationOutcome,
    now: string,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE rating_batch_items
        SET status = $2,
            rating_run_id = $3,
            eligibility_result_id = $4,
            completed_at = $5,
            next_retry_at = NULL,
            last_error = NULL,
            unresolved_reasons = $6::jsonb,
            updated_at = $5
        WHERE id = $1 AND status = 'processing'
      `,
      [
        item.id,
        outcome.result.eligible ? "rated" : "unrated",
        outcome.saved.ratingRunId,
        outcome.saved.eligibilityResultId,
        now,
        JSON.stringify(outcome.result.eligible ? [] : outcome.result.reasons),
      ],
    );
    await this.reconcile(item.batchRunId, now);
  }

  public async retryWork(
    item: RatingBatchWorkItem,
    error: string,
    nextRetryAt: string,
    now: string,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE rating_batch_items
        SET status = 'pending',
            next_retry_at = $2,
            last_error = $3,
            updated_at = $4
        WHERE id = $1 AND status = 'processing'
      `,
      [item.id, nextRetryAt, error.slice(0, 4_000), now],
    );
    await this.reconcile(item.batchRunId, now);
  }

  public async failWork(
    item: RatingBatchWorkItem,
    error: string,
    now: string,
  ): Promise<void> {
    await this.pool.query(
      `
        UPDATE rating_batch_items
        SET status = 'failed',
            completed_at = $2,
            next_retry_at = NULL,
            last_error = $3,
            updated_at = $2
        WHERE id = $1 AND status = 'processing'
      `,
      [item.id, now, error.slice(0, 4_000)],
    );
    await this.reconcile(item.batchRunId, now);
  }

  public async requestCancellation(
    batchRunId: string,
    now: string,
  ): Promise<RatingBatchSnapshot> {
    const result = await this.pool.query(
      `
        UPDATE rating_batch_runs
        SET cancellation_requested = true,
            heartbeat_at = $2
        WHERE id = $1
        RETURNING id
      `,
      [batchRunId, now],
    );
    if (result.rowCount === 0) throw new Error(`Rating batch ${batchRunId} was not found.`);
    return this.getBatch(batchRunId);
  }

  public async heartbeat(batchRunId: string, now: string): Promise<void> {
    await this.pool.query(
      "UPDATE rating_batch_runs SET heartbeat_at = $2 WHERE id = $1 AND status = 'running'",
      [batchRunId, now],
    );
  }

  public async finalize(batchRunId: string, now: string): Promise<RatingBatchSnapshot> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const run = await client.query<{
        status: RatingBatchStatus;
        cancellation_requested: boolean;
      }>(
        "SELECT status, cancellation_requested FROM rating_batch_runs WHERE id = $1 FOR UPDATE",
        [batchRunId],
      );
      const current = run.rows[0];
      if (!current) throw new Error(`Rating batch ${batchRunId} was not found.`);
      if (["completed", "partial", "cancelled", "failed"].includes(current.status)) {
        await client.query("COMMIT");
        return this.getBatch(batchRunId);
      }

      if (current.cancellation_requested) {
        await client.query(
          `
            UPDATE rating_batch_items
            SET status = 'cancelled',
                completed_at = $2,
                next_retry_at = NULL,
                updated_at = $2
            WHERE batch_run_id = $1 AND status = 'pending'
          `,
          [batchRunId, now],
        );
      }

      const counts = await client.query<{
        pending_count: string | number;
        processing_count: string | number;
        rated_count: string | number;
        unrated_count: string | number;
        failed_count: string | number;
        cancelled_count: string | number;
      }>(
        `
          SELECT
            count(*) FILTER (WHERE status = 'pending') AS pending_count,
            count(*) FILTER (WHERE status = 'processing') AS processing_count,
            count(*) FILTER (WHERE status = 'rated') AS rated_count,
            count(*) FILTER (WHERE status = 'unrated') AS unrated_count,
            count(*) FILTER (WHERE status = 'failed') AS failed_count,
            count(*) FILTER (WHERE status = 'cancelled') AS cancelled_count
          FROM rating_batch_items
          WHERE batch_run_id = $1
        `,
        [batchRunId],
      );
      const values = counts.rows[0];
      const pendingCount = integer(values?.pending_count);
      const processingCount = integer(values?.processing_count);
      const ratedCount = integer(values?.rated_count);
      const unratedCount = integer(values?.unrated_count);
      const failedCount = integer(values?.failed_count);
      const cancelledCount = integer(values?.cancelled_count);
      const openCount = pendingCount + processingCount;

      if (openCount === 0) {
        const status: RatingBatchStatus = current.cancellation_requested
          ? "cancelled"
          : failedCount > 0
            ? ratedCount + unratedCount > 0
              ? "partial"
              : "failed"
            : "completed";
        await client.query(
          `
            UPDATE rating_batch_runs
            SET status = $2,
                claimed_count = (
                  SELECT count(*) FROM rating_batch_items
                  WHERE batch_run_id = $1 AND started_at IS NOT NULL
                ),
                rated_count = $3,
                unrated_count = $4,
                failed_count = $5,
                completed_at = $6,
                heartbeat_at = $6,
                failure_summary = CASE
                  WHEN $5 > 0 THEN $5::text || ' company rating attempts failed.'
                  WHEN $7 > 0 THEN $7::text || ' company ratings were cancelled.'
                  ELSE NULL
                END
            WHERE id = $1
          `,
          [batchRunId, status, ratedCount, unratedCount, failedCount, now, cancelledCount],
        );
      } else {
        await client.query(
          "UPDATE rating_batch_runs SET heartbeat_at = $2 WHERE id = $1",
          [batchRunId, now],
        );
      }
      await client.query("COMMIT");
      return this.getBatch(batchRunId);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getBatch(batchRunId: string): Promise<RatingBatchSnapshot> {
    const result = await this.pool.query<BatchSnapshotRow>(
      `
        SELECT
          rbr.id,
          rbr.engine_version,
          rbr.status,
          rbr.requested_count,
          rbr.claimed_count,
          rbr.rated_count,
          rbr.unrated_count,
          rbr.failed_count,
          rbr.concurrency,
          rbr.cancellation_requested,
          rbr.started_at,
          rbr.completed_at,
          rbr.heartbeat_at,
          rbr.failure_summary,
          count(*) FILTER (WHERE rbi.status = 'pending') AS pending_count,
          count(*) FILTER (WHERE rbi.status = 'processing') AS processing_count,
          count(*) FILTER (WHERE rbi.status = 'cancelled') AS cancelled_count,
          min(rbi.next_retry_at) FILTER (WHERE rbi.status = 'pending') AS next_retry_at
        FROM rating_batch_runs rbr
        LEFT JOIN rating_batch_items rbi ON rbi.batch_run_id = rbr.id
        WHERE rbr.id = $1
        GROUP BY rbr.id
      `,
      [batchRunId],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`Rating batch ${batchRunId} was not found.`);
    return snapshot(row);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export interface RatingBatchProcessorOptions {
  readonly store: RatingBatchStore;
  readonly service: ProductionRatingService;
  readonly maxAttempts?: number;
  readonly baseRetryDelayMs?: number;
  readonly maximumRetryDelayMs?: number;
  readonly staleAfterMinutes?: number;
  readonly clock?: () => Date;
  readonly sleep?: (milliseconds: number) => Promise<void>;
}

export class RatingBatchProcessor {
  private readonly maxAttempts: number;
  private readonly baseRetryDelayMs: number;
  private readonly maximumRetryDelayMs: number;
  private readonly staleAfterMinutes: number;
  private readonly clock: () => Date;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  public constructor(private readonly options: RatingBatchProcessorOptions) {
    this.maxAttempts = Math.min(Math.max(Math.trunc(options.maxAttempts ?? 3), 1), 10);
    this.baseRetryDelayMs = Math.max(1_000, Math.trunc(options.baseRetryDelayMs ?? 30_000));
    this.maximumRetryDelayMs = Math.max(
      this.baseRetryDelayMs,
      Math.trunc(options.maximumRetryDelayMs ?? 15 * 60_000),
    );
    this.staleAfterMinutes = Math.min(
      Math.max(Math.trunc(options.staleAfterMinutes ?? 30), 5),
      24 * 60,
    );
    this.clock = options.clock ?? (() => new Date());
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  private now(): string {
    const value = this.clock();
    if (Number.isNaN(value.getTime())) throw new Error("Rating batch clock returned an invalid date.");
    return value.toISOString();
  }

  private retryAt(attemptCount: number): string {
    const delay = Math.min(
      this.maximumRetryDelayMs,
      this.baseRetryDelayMs * 2 ** Math.max(0, attemptCount - 1),
    );
    return new Date(Date.parse(this.now()) + delay).toISOString();
  }

  private async processItem(item: RatingBatchWorkItem): Promise<void> {
    try {
      const outcome = await this.options.service.calculateAndStore(item.company);
      await this.options.store.completeWork(item, outcome, this.now());
    } catch (error) {
      const message = errorMessage(error);
      if (item.attemptCount < this.maxAttempts) {
        await this.options.store.retryWork(item, message, this.retryAt(item.attemptCount), this.now());
      } else {
        await this.options.store.failWork(item, message, this.now());
      }
    }
  }

  public async run(batchRunId: string): Promise<RatingBatchSnapshot> {
    while (true) {
      const current = await this.options.store.getBatch(batchRunId);
      if (["completed", "partial", "cancelled", "failed"].includes(current.status)) {
        return current;
      }
      if (current.cancellationRequested) {
        const cancelled = await this.options.store.finalize(batchRunId, this.now());
        if (cancelled.status === "cancelled") return cancelled;
      }

      const work = await this.options.store.claimWork(
        batchRunId,
        current.concurrency,
        this.now(),
        this.staleAfterMinutes,
      );
      if (work.length === 0) {
        const finalized = await this.options.store.finalize(batchRunId, this.now());
        if (["completed", "partial", "cancelled", "failed"].includes(finalized.status)) {
          return finalized;
        }
        const nextRetryTime = finalized.nextRetryAt ? Date.parse(finalized.nextRetryAt) : NaN;
        const waitMs = Number.isFinite(nextRetryTime)
          ? Math.min(Math.max(nextRetryTime - Date.parse(this.now()), 1_000), 30_000)
          : 1_000;
        await this.sleep(waitMs);
        continue;
      }

      await Promise.all(work.map((item) => this.processItem(item)));
      await this.options.store.heartbeat(batchRunId, this.now());
    }
  }
}

export function createRatingBatchStore(databaseUrl: string | null): RatingBatchStore {
  return databaseUrl ? new PostgresRatingBatchStore(databaseUrl) : new UnconfiguredRatingBatchStore();
}
