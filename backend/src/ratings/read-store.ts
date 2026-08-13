// TS: 2026-08-09 11:03 ET

import pg from "pg";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export interface RatingReadStoreStatus {
  readonly configured: boolean;
  readonly schemaReady: boolean;
  readonly ratedCount: number;
  readonly eligibilityCount: number;
  readonly latestCalculatedAt: string | null;
  readonly message: string;
}

export interface RatingReadStore {
  readonly configured: boolean;
  getCurrent(symbol: string): Promise<Record<string, unknown> | null>;
  getHistory(symbol: string, limit?: number): Promise<readonly Record<string, unknown>[]>;
  getStatus(): Promise<RatingReadStoreStatus>;
  close(): Promise<void>;
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return symbol;
}

function isMissingRatingSchema(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "42P01",
  );
}

class UnconfiguredRatingReadStore implements RatingReadStore {
  public readonly configured = false;

  public async getCurrent(_symbol: string): Promise<Record<string, unknown> | null> {
    return null;
  }

  public async getHistory(
    _symbol: string,
    _limit = 20,
  ): Promise<readonly Record<string, unknown>[]> {
    return Object.freeze([]);
  }

  public async getStatus(): Promise<RatingReadStoreStatus> {
    return Object.freeze({
      configured: false,
      schemaReady: false,
      ratedCount: 0,
      eligibilityCount: 0,
      latestCalculatedAt: null,
      message: "Production rating database is not configured.",
    });
  }

  public async close(): Promise<void> {}
}

class PostgresRatingReadStore implements RatingReadStore {
  public readonly configured = true;
  private readonly pool: DatabasePool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 3,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  public async getCurrent(symbol: string): Promise<Record<string, unknown> | null> {
    const normalized = normalizeSymbol(symbol);
    try {
      const result = await this.pool.query<{ result_payload: Record<string, unknown> }>(
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
              AND result_payload IS NOT NULL
          )
          SELECT result_payload
          FROM latest_result
          ORDER BY event_time DESC
          LIMIT 1
        `,
        [normalized],
      );
      return result.rows[0]?.result_payload ?? null;
    } catch (error) {
      if (isMissingRatingSchema(error)) return null;
      throw error;
    }
  }

  public async getHistory(
    symbol: string,
    limit = 20,
  ): Promise<readonly Record<string, unknown>[]> {
    const normalized = normalizeSymbol(symbol);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    try {
      const result = await this.pool.query<Record<string, unknown>>(
        `
          SELECT
            mrr.score,
            mrr.tier,
            mrr.rating_version AS "engineVersion",
            mrr.calculated_at AS "calculatedAt",
            mrr.data_as_of AS "dataAsOf",
            mrr.data_completeness_score AS "dataCompletenessScore",
            mrr.confidence,
            mrr.change_reasons AS "changeReasons"
          FROM monster_rating_runs mrr
          JOIN companies c ON c.id = mrr.company_id
          WHERE c.ticker = $1 AND mrr.status = 'complete'
          ORDER BY mrr.calculated_at DESC, mrr.id DESC
          LIMIT $2
        `,
        [normalized, safeLimit],
      );
      return Object.freeze(result.rows.map((row) => Object.freeze({ ...row })));
    } catch (error) {
      if (isMissingRatingSchema(error)) return Object.freeze([]);
      throw error;
    }
  }

  public async getStatus(): Promise<RatingReadStoreStatus> {
    try {
      const result = await this.pool.query<{
        rated_count: string | number;
        eligibility_count: string | number;
        latest_calculated_at: Date | string | null;
      }>(
        `
          SELECT
            (SELECT COUNT(*) FROM monster_rating_runs WHERE status = 'complete') AS rated_count,
            (SELECT COUNT(*) FROM rating_eligibility_results) AS eligibility_count,
            (SELECT MAX(calculated_at) FROM monster_rating_runs WHERE status = 'complete') AS latest_calculated_at
        `,
      );
      const row = result.rows[0];
      return Object.freeze({
        configured: true,
        schemaReady: true,
        ratedCount: Number(row?.rated_count ?? 0),
        eligibilityCount: Number(row?.eligibility_count ?? 0),
        latestCalculatedAt: row?.latest_calculated_at
          ? new Date(row.latest_calculated_at).toISOString()
          : null,
        message: "Production rating read path is available.",
      });
    } catch (error) {
      if (isMissingRatingSchema(error)) {
        return Object.freeze({
          configured: true,
          schemaReady: false,
          ratedCount: 0,
          eligibilityCount: 0,
          latestCalculatedAt: null,
          message: "Database is connected, but production rating tables are not installed yet.",
        });
      }
      throw error;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createRatingReadStore(databaseUrl: string | null): RatingReadStore {
  return databaseUrl
    ? new PostgresRatingReadStore(databaseUrl)
    : new UnconfiguredRatingReadStore();
}
