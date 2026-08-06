// TS: 2026-08-05 08:22 ET

import pg from "pg";
import { ProviderNotConfiguredError } from "../providers/types.js";
import type { ProductionRatingResult } from "./types.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export interface SavedRatingResult {
  readonly ratingRunId: string | null;
  readonly eligibilityResultId: string | null;
}

export interface RatingHistoryEntry {
  readonly score: number;
  readonly tier: string;
  readonly engineVersion: string;
  readonly calculatedAt: string;
  readonly dataAsOf: string;
  readonly dataCompletenessScore: number | null;
  readonly confidence: string | null;
  readonly changeReasons: readonly unknown[];
}

export interface RatingStoreStatus {
  readonly configured: boolean;
  readonly universeCount: number;
  readonly ratedCount: number;
  readonly unratedCount: number;
  readonly unratedByReason: Readonly<Record<string, number>>;
  readonly latestCalculatedAt: string | null;
  readonly activeBatch: {
    readonly id: string;
    readonly status: string;
    readonly requestedCount: number;
    readonly claimedCount: number;
    readonly ratedCount: number;
    readonly unratedCount: number;
    readonly failedCount: number;
    readonly heartbeatAt: string | null;
    readonly cancellationRequested: boolean;
  } | null;
}

export interface RatingStore {
  readonly name: string;
  readonly configured: boolean;
  saveResult(result: ProductionRatingResult): Promise<SavedRatingResult>;
  getCurrent(symbol: string): Promise<ProductionRatingResult | null>;
  getHistory(symbol: string, limit?: number): Promise<readonly RatingHistoryEntry[]>;
  getStatus(): Promise<RatingStoreStatus>;
  close(): Promise<void>;
}

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return normalized;
}

function numberValue(value: string | number | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value: Date | string | null): string | null {
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function jsonArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? Object.freeze([...value]) : Object.freeze([]);
}

export class UnconfiguredRatingStore implements RatingStore {
  public readonly name = "unconfigured-rating-store";
  public readonly configured = false;

  private unavailable(): never {
    throw new ProviderNotConfiguredError("Production rating database");
  }

  public async saveResult(_result: ProductionRatingResult): Promise<SavedRatingResult> {
    return this.unavailable();
  }

  public async getCurrent(_symbol: string): Promise<ProductionRatingResult | null> {
    return this.unavailable();
  }

  public async getHistory(
    _symbol: string,
    _limit = 20,
  ): Promise<readonly RatingHistoryEntry[]> {
    return this.unavailable();
  }

  public async getStatus(): Promise<RatingStoreStatus> {
    return this.unavailable();
  }

  public async close(): Promise<void> {}
}

export class PostgresRatingStore implements RatingStore {
  public readonly name = "postgresql-rating-store";
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

  public async saveResult(result: ProductionRatingResult): Promise<SavedRatingResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const companyResult = await client.query<{ id: string | number }>(
        "SELECT id FROM companies WHERE ticker = $1 AND is_active = true",
        [normalizeSymbol(result.symbol)],
      );
      const companyId = companyResult.rows[0]?.id;
      if (companyId === undefined) {
        throw new Error(`Active coverage company ${result.symbol} was not found.`);
      }

      if (!result.eligible) {
        const inserted = await client.query<{ id: string | number }>(
          `
            INSERT INTO rating_eligibility_results (
              company_id,
              engine_version,
              eligibility_code,
              summary,
              reasons,
              data_completeness_score,
              data_as_of,
              evaluated_at,
              retry_after,
              provider_status,
              result_payload
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
            ON CONFLICT (company_id, engine_version, evaluated_at) DO UPDATE SET
              eligibility_code = EXCLUDED.eligibility_code,
              summary = EXCLUDED.summary,
              reasons = EXCLUDED.reasons,
              data_completeness_score = EXCLUDED.data_completeness_score,
              data_as_of = EXCLUDED.data_as_of,
              retry_after = EXCLUDED.retry_after,
              provider_status = EXCLUDED.provider_status,
              result_payload = EXCLUDED.result_payload
            RETURNING id
          `,
          [
            companyId,
            result.engineVersion,
            result.eligibilityCode,
            result.summary,
            JSON.stringify(result.reasons),
            result.dataCompletenessScore,
            result.dataAsOf,
            result.calculatedAt,
            result.reasons.some((reason) => reason.retryable)
              ? new Date(Date.parse(result.calculatedAt) + 24 * 60 * 60 * 1_000).toISOString()
              : null,
            JSON.stringify({ eligibilityCode: result.eligibilityCode }),
            JSON.stringify(result),
          ],
        );
        await client.query(
          `
            UPDATE company_pipeline_status
            SET rating_status = 'blocked',
                last_error = $2,
                last_completed_at = $3,
                next_retry_at = $4
            WHERE company_id = $1
          `,
          [
            companyId,
            result.reasons.map((reason) => reason.code).join(", "),
            result.calculatedAt,
            result.reasons.some((reason) => reason.retryable)
              ? new Date(Date.parse(result.calculatedAt) + 24 * 60 * 60 * 1_000).toISOString()
              : null,
          ],
        );
        await client.query("COMMIT");
        return Object.freeze({
          ratingRunId: null,
          eligibilityResultId: String(inserted.rows[0]?.id ?? ""),
        });
      }

      if (!result.dataAsOf) {
        throw new Error(`Eligible rating ${result.symbol} is missing dataAsOf.`);
      }

      const priorResult = await client.query<{
        id: string | number;
        score: string | number;
        result_payload: unknown;
      }>(
        `
          SELECT id, score, result_payload
          FROM monster_rating_runs
          WHERE company_id = $1 AND status = 'complete'
          ORDER BY calculated_at DESC, id DESC
          LIMIT 1
        `,
        [companyId],
      );
      const prior = priorResult.rows[0] ?? null;
      const priorScore = prior ? numberValue(prior.score) : null;
      const changeReasons = priorScore === null
        ? []
        : [
            {
              code: "score_change",
              priorScore,
              currentScore: result.score,
              change: result.score - priorScore,
            },
          ];

      const inserted = await client.query<{ id: string | number }>(
        `
          INSERT INTO monster_rating_runs (
            company_id,
            rating_version,
            score,
            tier,
            status,
            calculated_at,
            data_as_of,
            summary,
            risks,
            evidence_count,
            source_count,
            confidence,
            data_completeness_score,
            eligibility_code,
            positive_drivers,
            negative_drivers,
            result_payload,
            prior_rating_run_id,
            change_reasons
          )
          VALUES (
            $1, $2, $3, $4, 'complete', $5, $6, $7, $8, $9, $10,
            $11, $12, 'eligible', $13::jsonb, $14::jsonb, $15::jsonb, $16, $17::jsonb
          )
          ON CONFLICT (company_id, rating_version, calculated_at) DO UPDATE SET
            score = EXCLUDED.score,
            tier = EXCLUDED.tier,
            data_as_of = EXCLUDED.data_as_of,
            summary = EXCLUDED.summary,
            risks = EXCLUDED.risks,
            evidence_count = EXCLUDED.evidence_count,
            source_count = EXCLUDED.source_count,
            confidence = EXCLUDED.confidence,
            data_completeness_score = EXCLUDED.data_completeness_score,
            positive_drivers = EXCLUDED.positive_drivers,
            negative_drivers = EXCLUDED.negative_drivers,
            result_payload = EXCLUDED.result_payload,
            prior_rating_run_id = EXCLUDED.prior_rating_run_id,
            change_reasons = EXCLUDED.change_reasons
          RETURNING id
        `,
        [
          companyId,
          result.engineVersion,
          result.score,
          result.tier,
          result.calculatedAt,
          result.dataAsOf,
          result.summary,
          result.risks,
          result.evidenceInputs.length,
          result.evidenceInputs.length,
          result.confidence,
          result.dataCompletenessScore,
          JSON.stringify(result.positiveDrivers),
          JSON.stringify(result.negativeDrivers),
          JSON.stringify(result),
          prior?.id ?? null,
          JSON.stringify(changeReasons),
        ],
      );
      const ratingRunId = inserted.rows[0]?.id;
      if (ratingRunId === undefined) throw new Error("Unable to persist rating run.");

      await client.query("DELETE FROM monster_rating_components WHERE rating_run_id = $1", [
        ratingRunId,
      ]);
      await client.query("DELETE FROM monster_rating_sources WHERE rating_run_id = $1", [
        ratingRunId,
      ]);

      for (const component of result.components) {
        await client.query(
          `
            INSERT INTO monster_rating_components (
              rating_run_id,
              component_key,
              component_label,
              raw_value,
              normalized_score,
              weight,
              weighted_score,
              direction,
              explanation
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            ratingRunId,
            component.key,
            component.label,
            component.score,
            component.score,
            component.weight,
            component.weightedScore,
            component.direction,
            component.explanation,
          ],
        );
      }

      const sources = new Map<
        string,
        {
          readonly sourceType: string;
          readonly sourceName: string;
          readonly sourceUrl: string | null;
          readonly sourceTimestamp: string | null;
          readonly components: Set<string>;
        }
      >();
      for (const component of result.components) {
        for (const item of component.evidence) {
          const identity = `${item.sourceType}|${item.sourceUrl ?? ""}|${item.sourceTimestamp ?? ""}`;
          const current = sources.get(identity) ?? {
            sourceType: item.sourceType,
            sourceName:
              item.sourceType === "market-data"
                ? "External Market Data · May Be Delayed"
                : item.sourceType === "derived"
                  ? "Monster Rating™ deterministic derivation"
                  : "Official SEC Evidence",
            sourceUrl: item.sourceUrl,
            sourceTimestamp: item.sourceTimestamp,
            components: new Set<string>(),
          };
          current.components.add(component.key);
          sources.set(identity, current);
        }
      }
      for (const source of sources.values()) {
        await client.query(
          `
            INSERT INTO monster_rating_sources (
              rating_run_id,
              source_type,
              source_name,
              source_url,
              source_timestamp,
              supports_components,
              notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            ratingRunId,
            source.sourceType,
            source.sourceName,
            source.sourceUrl,
            source.sourceTimestamp,
            [...source.components],
            "Stored from nym-rating-v1.0.0 evidence inputs.",
          ],
        );
      }

      await client.query(
        `
          UPDATE company_pipeline_status
          SET rating_status = 'complete',
              last_error = NULL,
              last_completed_at = $2,
              next_retry_at = NULL
          WHERE company_id = $1
        `,
        [companyId, result.calculatedAt],
      );
      await client.query("COMMIT");
      return Object.freeze({
        ratingRunId: String(ratingRunId),
        eligibilityResultId: null,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  public async getCurrent(symbol: string): Promise<ProductionRatingResult | null> {
    const normalized = normalizeSymbol(symbol);
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        result_payload: ProductionRatingResult;
        event_time: Date | string;
      }>(
        `
          WITH target AS (
            SELECT id FROM companies WHERE ticker = $1 AND is_active = true
          ), latest_result AS (
            SELECT result_payload, calculated_at AS event_time
            FROM monster_rating_runs
            WHERE company_id = (SELECT id FROM target)
              AND status = 'complete'
              AND result_payload IS NOT NULL
            UNION ALL
            SELECT result_payload, evaluated_at AS event_time
            FROM rating_eligibility_results
            WHERE company_id = (SELECT id FROM target)
          )
          SELECT result_payload, event_time
          FROM latest_result
          ORDER BY event_time DESC
          LIMIT 1
        `,
        [normalized],
      );
      return result.rows[0]?.result_payload ?? null;
    } finally {
      client.release();
    }
  }

  public async getHistory(symbol: string, limit = 20): Promise<readonly RatingHistoryEntry[]> {
    const normalized = normalizeSymbol(symbol);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        score: string | number;
        tier: string;
        rating_version: string;
        calculated_at: Date | string;
        data_as_of: Date | string;
        data_completeness_score: string | number | null;
        confidence: string | null;
        change_reasons: unknown;
      }>(
        `
          SELECT
            mrr.score,
            mrr.tier,
            mrr.rating_version,
            mrr.calculated_at,
            mrr.data_as_of,
            mrr.data_completeness_score,
            mrr.confidence,
            mrr.change_reasons
          FROM monster_rating_runs mrr
          JOIN companies c ON c.id = mrr.company_id
          WHERE c.ticker = $1 AND mrr.status = 'complete'
          ORDER BY mrr.calculated_at DESC, mrr.id DESC
          LIMIT $2
        `,
        [normalized, safeLimit],
      );
      return Object.freeze(
        result.rows.map((row) => ({
          score: numberValue(row.score) ?? 0,
          tier: row.tier,
          engineVersion: row.rating_version,
          calculatedAt: timestamp(row.calculated_at) ?? "",
          dataAsOf: timestamp(row.data_as_of) ?? "",
          dataCompletenessScore: numberValue(row.data_completeness_score),
          confidence: row.confidence,
          changeReasons: jsonArray(row.change_reasons),
        })),
      );
    } finally {
      client.release();
    }
  }

  public async getStatus(): Promise<RatingStoreStatus> {
    const client = await this.pool.connect();
    try {
      const [countsResult, reasonResult, batchResult] = await Promise.all([
        client.query<{
          universe_count: string | number;
          rated_count: string | number;
          latest_calculated_at: Date | string | null;
        }>(
          `
            SELECT
              (SELECT count(*) FROM companies WHERE is_active = true) AS universe_count,
              (SELECT count(*) FROM latest_monster_ratings lmr
                JOIN companies c ON c.id = lmr.company_id
                WHERE c.is_active = true) AS rated_count,
              (SELECT max(calculated_at) FROM monster_rating_runs WHERE status = 'complete')
                AS latest_calculated_at
          `,
        ),
        client.query<{ eligibility_code: string; count: string | number }>(
          `
            SELECT lre.eligibility_code, count(*) AS count
            FROM latest_rating_eligibility lre
            JOIN companies c ON c.id = lre.company_id
            LEFT JOIN latest_monster_ratings lmr ON lmr.company_id = c.id
            WHERE c.is_active = true
              AND (lmr.calculated_at IS NULL OR lre.evaluated_at > lmr.calculated_at)
            GROUP BY lre.eligibility_code
            ORDER BY lre.eligibility_code
          `,
        ),
        client.query<{
          id: string | number;
          status: string;
          requested_count: string | number;
          claimed_count: string | number;
          rated_count: string | number;
          unrated_count: string | number;
          failed_count: string | number;
          heartbeat_at: Date | string | null;
          cancellation_requested: boolean;
        }>(
          `
            SELECT *
            FROM rating_batch_runs
            WHERE status IN ('pending', 'running', 'partial')
            ORDER BY created_at DESC
            LIMIT 1
          `,
        ),
      ]);
      const counts = countsResult.rows[0];
      const universeCount = Number(counts?.universe_count ?? 0);
      const ratedCount = Number(counts?.rated_count ?? 0);
      const unratedByReason = Object.freeze(
        Object.fromEntries(
          reasonResult.rows.map((row) => [row.eligibility_code, Number(row.count)]),
        ),
      );
      const active = batchResult.rows[0] ?? null;
      return Object.freeze({
        configured: true,
        universeCount,
        ratedCount,
        unratedCount: Math.max(0, universeCount - ratedCount),
        unratedByReason,
        latestCalculatedAt: timestamp(counts?.latest_calculated_at ?? null),
        activeBatch: active
          ? Object.freeze({
              id: String(active.id),
              status: active.status,
              requestedCount: Number(active.requested_count),
              claimedCount: Number(active.claimed_count),
              ratedCount: Number(active.rated_count),
              unratedCount: Number(active.unrated_count),
              failedCount: Number(active.failed_count),
              heartbeatAt: timestamp(active.heartbeat_at),
              cancellationRequested: active.cancellation_requested,
            })
          : null,
      });
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createRatingStore(databaseUrl: string | null): RatingStore {
  return databaseUrl ? new PostgresRatingStore(databaseUrl) : new UnconfiguredRatingStore();
}
