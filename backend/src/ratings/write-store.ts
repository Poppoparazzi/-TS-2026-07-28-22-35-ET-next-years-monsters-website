// TS: 2026-08-09 18:48 ET

import pg from "pg";
import type { ProductionRatingResult } from "./types.js";

const { Pool } = pg;

interface QueryResultLike<Row> {
  readonly rows: readonly Row[];
}

export interface RatingWriteClient {
  query<Row = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResultLike<Row>>;
  release(): void;
}

export interface RatingWritePool {
  connect(): Promise<RatingWriteClient>;
  end(): Promise<void>;
}

export interface SavedRatingResult {
  readonly ratingRunId: string | null;
  readonly eligibilityResultId: string | null;
}

export interface RatingWriteStore {
  readonly configured: boolean;
  saveResult(result: ProductionRatingResult): Promise<SavedRatingResult>;
  close(): Promise<void>;
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return symbol;
}

function retryAfter(result: ProductionRatingResult): string | null {
  if (result.eligible || !result.reasons.some((reason) => reason.retryable)) return null;
  const calculatedAt = Date.parse(result.calculatedAt);
  if (!Number.isFinite(calculatedAt)) return null;
  return new Date(calculatedAt + 24 * 60 * 60 * 1_000).toISOString();
}

export async function persistRatingResult(
  pool: RatingWritePool,
  result: ProductionRatingResult,
): Promise<SavedRatingResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const company = await client.query<{ id: string | number }>(
      "SELECT id FROM companies WHERE ticker = $1 AND is_active = true FOR SHARE",
      [normalizeSymbol(result.symbol)],
    );
    const companyId = company.rows[0]?.id;
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
          retryAfter(result),
          JSON.stringify({ eligibilityCode: result.eligibilityCode }),
          JSON.stringify(result),
        ],
      );

      const eligibilityResultId = inserted.rows[0]?.id;
      if (eligibilityResultId === undefined) {
        throw new Error("Unable to persist rating eligibility result.");
      }

      await client.query("COMMIT");
      return Object.freeze({
        ratingRunId: null,
        eligibilityResultId: String(eligibilityResultId),
      });
    }

    if (!result.dataAsOf) {
      throw new Error(`Eligible rating ${result.symbol} is missing dataAsOf.`);
    }

    const prior = await client.query<{ id: string | number; score: string | number }>(
      `
        SELECT id, score
        FROM monster_rating_runs
        WHERE company_id = $1 AND status = 'complete'
        ORDER BY calculated_at DESC, id DESC
        LIMIT 1
      `,
      [companyId],
    );
    const priorRow = prior.rows[0] ?? null;
    const priorScore = priorRow === null ? null : Number(priorRow.score);
    const changeReasons = priorScore === null || !Number.isFinite(priorScore)
      ? []
      : [{
          code: "score_change",
          priorScore,
          currentScore: result.score,
          change: result.score - priorScore,
        }];

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
        priorRow?.id ?? null,
        JSON.stringify(changeReasons),
      ],
    );

    const ratingRunId = inserted.rows[0]?.id;
    if (ratingRunId === undefined) throw new Error("Unable to persist rating run.");

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

class UnconfiguredRatingWriteStore implements RatingWriteStore {
  public readonly configured = false;

  public async saveResult(_result: ProductionRatingResult): Promise<SavedRatingResult> {
    throw new Error("Production rating database is not configured.");
  }

  public async close(): Promise<void> {}
}

class PostgresRatingWriteStore implements RatingWriteStore {
  public readonly configured = true;
  private readonly pool: RatingWritePool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    }) as unknown as RatingWritePool;
  }

  public async saveResult(result: ProductionRatingResult): Promise<SavedRatingResult> {
    return persistRatingResult(this.pool, result);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createRatingWriteStore(databaseUrl: string | null): RatingWriteStore {
  return databaseUrl
    ? new PostgresRatingWriteStore(databaseUrl)
    : new UnconfiguredRatingWriteStore();
}
