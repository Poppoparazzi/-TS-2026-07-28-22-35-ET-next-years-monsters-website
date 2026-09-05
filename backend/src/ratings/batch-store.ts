// TS: 2026-09-05 09:02 ET

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
      AND (
        (
          mhe.rating_history_ready = false
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
        OR (
          mhe.suppression_reason = 'insufficient_liquidity'
          AND CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '30 days'
        )
        OR (
          mhe.suppression_reason = 'stale_market_data'
          AND CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '2 days'
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
      AND prior_failure ->> 'suppressionStage' = 'sec_preflight'
      AND prior_failure ->> 'reasonCode' IN (
        'unresolved_sec_identity',
        'insufficient_financial_history',
        'unsupported_security_type'
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