// TS: 2026-09-04 11:02 ET

import pg from "pg";
import type { AppConfig } from "../config.js";
import {
  getPersistedMarketHistorySuppressionByTicker,
  type PersistedMarketHistorySuppression,
  upsertMarketHistoryEvidence,
} from "../database/market-history-evidence-persistence.js";
import {
  isProtectedCompany,
  PROTECTED_COMPANY_SQL_PREDICATE,
} from "../policy/protected-stocks.js";
import { ProviderNotConfiguredError } from "../providers/types.js";
import { MONSTER_RATING_ENGINE_VERSION } from "./engine-v1.js";
import type { MarketHistoryEvidence } from "./market-history-evidence.js";

const { Pool } = pg;
type DatabasePool = InstanceType<typeof Pool>;

export const EXCLUDE_CURRENT_COMPLETED_RATING_SQL = `
  NOT EXISTS (
    SELECT 1
    FROM monster_rating_runs mrr
    WHERE mrr.company_id = c.id
      AND mrr.rating_version = $2
      AND mrr.status = 'complete'
  )
`;

export const EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL = `
  NOT EXISTS (
    SELECT 1
    FROM market_history_evidence_latest mhe
    WHERE mhe.company_id = c.id
      AND mhe.rating_history_ready = false
      AND (
        CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '30 days'
        OR (
          mhe.latest_bar_date IS NOT NULL
          AND (
            SELECT count(*)
            FROM generate_series(
              mhe.latest_bar_date + INTERVAL '1 day',
              CURRENT_DATE,
              INTERVAL '1 day'
            ) AS candidate_session(day)
            WHERE EXTRACT(ISODOW FROM candidate_session.day) BETWEEN 1 AND 5
          ) <
            (253 - mhe.usable_bar_count)
            + CEIL(GREATEST(253 - mhe.usable_bar_count, 0) / 20.0)
        )
      )
  )
`;

export const EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL = `
  NOT EXISTS (
    SELECT 1
    FROM data_refresh_runs drr
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(drr.metadata -> 'replaceable') = 'array'
          THEN drr.metadata -> 'replaceable'
        ELSE '[]'::jsonb
      END
    ) AS prior_failure
    WHERE drr.refresh_type = 'ratings'
      AND drr.started_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
      AND prior_failure ->> 'ticker' = c.ticker
      AND prior_failure ->> 'suppressionStage' IN ('sec_preflight', 'rating_engine')
      AND prior_failure ->> 'reasonCode' IN (
        'unresolved_sec_identity',
        'insufficient_financial_history',
        'unsupported_security_type',
        'insufficient_market_history',
        'insufficient_liquidity'
      )
  )
`;

export interface RatingBatchCandidate {
  readonly ticker: string;
  readonly companyName: string;
  readonly isPilot: boolean;
  readonly isProtected: boolean;
  readonly priorityMetric: number;
}

export interface RatingBatchFailure {
  readonly ticker: string;
  readonly reason: string;
  readonly reasonCode?: string;
  readonly suppressionStage?: string;
}

export interface RatingBatchAccounting {
  readonly targetCount: number;
  readonly candidateLimit: number;
  readonly totalCandidatesExamined: number;
  readonly ratedCount: number;
  readonly protectedMustRepairCount: number;
  readonly replaceableCount: number;
  readonly replacementsAttempted: number;
  readonly finalUsableUniverse: number;
  readonly protectedMustRepair: readonly RatingBatchFailure[];
  readonly replaceable: readonly RatingBatchFailure[];
  readonly suppressionReasonCounts?: Readonly<Record<string, number>>;
  readonly suppressionStageCounts?: Readonly<Record<string, number>>;
  readonly ratedTickers: readonly string[];
  readonly stoppedReason: string | null;
  readonly completedAt: string;
}

export interface RatingBatchStore {
  readonly name: string;
  readonly configured: boolean;
  listCandidates(limit: number): Promise<readonly RatingBatchCandidate[]>;
  startRun(targetCount: number, provider: string): Promise<string>;
  getReusableMarketHistorySuppression(
    ticker: string,
    provider: string,
  ): Promise<PersistedMarketHistorySuppression | null>;
  saveMarketHistoryEvidence(evidence: MarketHistoryEvidence): Promise<void>;
  recordCandidateFailure?(
    runId: string,
    failure: RatingBatchFailure,
    protectedCandidate: boolean,
  ): Promise<void>;
  finishRun(runId: string, accounting: RatingBatchAccounting): Promise<void>;
  close(): Promise<void>;
}

interface CandidateRow {
  readonly ticker: string;
  readonly company_name: string;
  readonly is_pilot: boolean;
  readonly priority_metric: string | number | null;
}

function stoppedByBatchLevelInfrastructure(accounting: RatingBatchAccounting): boolean {
  if (!accounting.stoppedReason) return false;
  return /^(Benchmark market history|Market-data provider|Upstream transport)/i.test(accounting.stoppedReason);
}

function completedNormalCandidatePass(accounting: RatingBatchAccounting): boolean {
  return accounting.stoppedReason === null;
}

export class UnconfiguredRatingBatchStore implements RatingBatchStore {
  public readonly name = "unconfigured-database";
  public readonly configured = false;

  public async listCandidates(_limit: number): Promise<readonly RatingBatchCandidate[]> {
    throw new ProviderNotConfiguredError("Rating batch database");
  }

  public async startRun(_targetCount: number, _provider: string): Promise<string> {
    throw new ProviderNotConfiguredError("Rating batch database");
  }

  public async getReusableMarketHistorySuppression(
    _ticker: string,
    _provider: string,
  ): Promise<PersistedMarketHistorySuppression | null> {
    throw new ProviderNotConfiguredError("Rating batch database");
  }

  public async saveMarketHistoryEvidence(_evidence: MarketHistoryEvidence): Promise<void> {
    throw new ProviderNotConfiguredError("Rating batch database");
  }

  public async recordCandidateFailure(
    _runId: string,
    _failure: RatingBatchFailure,
    _protectedCandidate: boolean,
  ): Promise<void> {
    throw new ProviderNotConfiguredError("Rating batch database");
  }

  public async finishRun(_runId: string, _accounting: RatingBatchAccounting): Promise<void> {
    throw new ProviderNotConfiguredError("Rating batch database");
  }

  public async close(): Promise<void> {}
}

export class PostgresRatingBatchStore implements RatingBatchStore {
  public readonly name = "postgresql";
  public readonly configured = true;
  private readonly pool: DatabasePool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  public async listCandidates(limit: number): Promise<readonly RatingBatchCandidate[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 5_000);
    const result = await this.pool.query<CandidateRow>(
      `
        SELECT c.ticker, c.company_name, c.is_pilot,
          COALESCE(revenue_metric.latest_annual_revenue, 0) AS priority_metric
        FROM companies c
        JOIN company_pipeline_status cps ON cps.company_id = c.id
        LEFT JOIN LATERAL (
          SELECT cf.value_numeric AS latest_annual_revenue
          FROM company_facts cf
          WHERE cf.company_id = c.id AND cf.taxonomy = 'us-gaap'
            AND cf.concept IN ('RevenueFromContractWithCustomerExcludingAssessedTax','Revenues','SalesRevenueNet')
            AND cf.value_numeric IS NOT NULL AND cf.value_numeric >= 0 AND cf.fiscal_period = 'FY'
            AND cf.form_type IN ('10-K','10-K/A','20-F','20-F/A','40-F','40-F/A')
          ORDER BY cf.fiscal_year DESC NULLS LAST, cf.period_end DESC NULLS LAST, cf.filed_date DESC NULLS LAST
          LIMIT 1
        ) revenue_metric ON true
        LEFT JOIN LATERAL (SELECT count(*) AS fact_count FROM company_facts cf WHERE cf.company_id = c.id) fact_depth ON true
        LEFT JOIN LATERAL (SELECT count(*) AS filing_count FROM sec_filings sf WHERE sf.company_id = c.id) filing_depth ON true
        LEFT JOIN LATERAL (
          SELECT (qs.price * qs.volume)::numeric AS dollar_volume
          FROM quote_snapshots qs
          WHERE qs.company_id = c.id
            AND qs.price > 0
            AND qs.volume > 0
            AND qs.provider_timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
            AND qs.provider_timestamp <= CURRENT_TIMESTAMP + INTERVAL '5 minutes'
          ORDER BY qs.provider_timestamp DESC, qs.retrieved_at DESC
          LIMIT 1
        ) stored_liquidity ON true
        LEFT JOIN market_history_evidence_latest history_readiness ON history_readiness.company_id = c.id
        WHERE c.is_active = true AND cps.sec_status = 'complete' AND c.sec_cik IS NOT NULL
          AND EXISTS (SELECT 1 FROM sec_filings sf WHERE sf.company_id = c.id)
          AND EXISTS (SELECT 1 FROM company_facts cf WHERE cf.company_id = c.id)
          AND ${EXCLUDE_CURRENT_COMPLETED_RATING_SQL}
          AND ${EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL}
          AND ${EXCLUDE_RECENT_REPLACEABLE_FAILURE_SQL}
        ORDER BY CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE} THEN 0 ELSE 1 END,
          c.is_pilot DESC,
          CASE WHEN history_readiness.rating_history_ready = true THEN 0 WHEN history_readiness.rating_history_ready IS NULL THEN 1 ELSE 2 END,
          CASE
            WHEN history_readiness.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
              AND history_readiness.twenty_session_average_dollar_volume >= 1000000 THEN 0
            WHEN history_readiness.twenty_session_average_dollar_volume IS NULL
              OR history_readiness.retrieved_at < CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1
            ELSE 2
          END,
          COALESCE(
            CASE WHEN history_readiness.retrieved_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
              AND history_readiness.twenty_session_average_dollar_volume >= 1000000
              THEN history_readiness.twenty_session_average_dollar_volume END,
            -1
          ) DESC,
          CASE WHEN stored_liquidity.dollar_volume IS NOT NULL THEN 0 ELSE 1 END,
          COALESCE(stored_liquidity.dollar_volume, -1) DESC,
          COALESCE(fact_depth.fact_count, 0) DESC,
          COALESCE(filing_depth.filing_count, 0) DESC,
          COALESCE(revenue_metric.latest_annual_revenue, -1) DESC,
          c.ticker
        LIMIT $1
      `,
      [safeLimit, MONSTER_RATING_ENGINE_VERSION],
    );

    return Object.freeze(result.rows.map((row) => Object.freeze({
      ticker: row.ticker,
      companyName: row.company_name,
      isPilot: row.is_pilot,
      isProtected: isProtectedCompany(row.ticker, row.is_pilot),
      priorityMetric: Number(row.priority_metric ?? 0),
    })));
  }

  public async startRun(targetCount: number, provider: string): Promise<string> {
    const result = await this.pool.query<{ id: string | number }>(
      `INSERT INTO data_refresh_runs (refresh_type, provider, status, requested_count, metadata)
       VALUES ('ratings', $1, 'running', $2, $3::jsonb) RETURNING id`,
      [provider, targetCount, JSON.stringify({ ratingVersion: MONSTER_RATING_ENGINE_VERSION, rollout: "first_500_then_full_reserve", protectedPolicy: "must_repair", ordinaryFailurePolicy: "replace_from_reserve" })],
    );
    const id = result.rows[0]?.id;
    if (id === undefined) throw new Error("Unable to start rating refresh run.");
    return String(id);
  }

  public async getReusableMarketHistorySuppression(ticker: string, provider: string): Promise<PersistedMarketHistorySuppression | null> {
    return getPersistedMarketHistorySuppressionByTicker(this.pool, ticker, provider);
  }

  public async saveMarketHistoryEvidence(evidence: MarketHistoryEvidence): Promise<void> {
    const client = await this.pool.connect();
    try {
      const companyResult = await client.query<{ id: string | number }>("SELECT id FROM companies WHERE ticker = $1 LIMIT 1", [evidence.symbol]);
      const companyId = companyResult.rows[0]?.id;
      if (companyId === undefined) throw new Error(`Unable to associate market history evidence with ${evidence.symbol}.`);
      await upsertMarketHistoryEvidence(client, String(companyId), evidence);
    } finally {
      client.release();
    }
  }

  public async recordCandidateFailure(
    runId: string,
    failure: RatingBatchFailure,
    protectedCandidate: boolean,
  ): Promise<void> {
    const bucket = protectedCandidate ? "protectedMustRepair" : "replaceable";
    await this.pool.query(
      `UPDATE data_refresh_runs
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         ARRAY[$2]::text[],
         COALESCE(metadata -> $2, '[]'::jsonb) || $3::jsonb,
         true
       )
       WHERE id = $1`,
      [runId, bucket, JSON.stringify([failure])],
    );
  }

  public async finishRun(runId: string, accounting: RatingBatchAccounting): Promise<void> {
    const status = accounting.ratedCount >= accounting.targetCount ? "completed" : accounting.ratedCount > 0 || stoppedByBatchLevelInfrastructure(accounting) || completedNormalCandidatePass(accounting) ? "partial" : "failed";
    await this.pool.query(
      `UPDATE data_refresh_runs SET status = $2, succeeded_count = $3, failed_count = $4,
       completed_at = $5, failure_summary = $6, metadata = metadata || $7::jsonb WHERE id = $1`,
      [runId, status, accounting.ratedCount, accounting.protectedMustRepairCount + accounting.replaceableCount, accounting.completedAt, accounting.stoppedReason, JSON.stringify(accounting)],
    );
  }

  public async close(): Promise<void> { await this.pool.end(); }
}

export function createRatingBatchStore(config: AppConfig): RatingBatchStore {
  return config.databaseUrl ? new PostgresRatingBatchStore(config.databaseUrl) : new UnconfiguredRatingBatchStore();
}
