// TS: 2026-09-04 14:02 ET

import pg from "pg";

const { Pool } = pg;

export const RATING_CANDIDATE_SUPPRESSION_REPORT_SQL = `
  WITH evidence AS (
    SELECT
      mhe.company_id,
      mhe.rating_history_ready,
      mhe.suppression_reason,
      mhe.usable_bar_count,
      mhe.latest_bar_date,
      mhe.retrieved_at,
      CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '30 days' AS in_cooldown,
      CASE
        WHEN mhe.latest_bar_date IS NULL THEN 0
        ELSE (
          SELECT count(*)
          FROM generate_series(
            mhe.latest_bar_date + INTERVAL '1 day',
            CURRENT_DATE,
            INTERVAL '1 day'
          ) AS candidate_session(day)
          WHERE EXTRACT(ISODOW FROM candidate_session.day) BETWEEN 1 AND 5
        )
      END AS plausible_sessions_since_latest,
      (253 - mhe.usable_bar_count)
        + CEIL(GREATEST(253 - mhe.usable_bar_count, 0) / 20.0) AS sessions_needed_with_holiday_allowance
    FROM market_history_evidence_latest mhe
  )
  SELECT
    count(*) FILTER (
      WHERE rating_history_ready = false
        AND in_cooldown
    ) AS cooldown_suppressed_count,
    count(*) FILTER (
      WHERE rating_history_ready = false
        AND NOT in_cooldown
        AND latest_bar_date IS NOT NULL
        AND plausible_sessions_since_latest < sessions_needed_with_holiday_allowance
    ) AS session_gap_suppressed_count,
    count(*) FILTER (
      WHERE rating_history_ready = false
        AND NOT in_cooldown
        AND (
          latest_bar_date IS NULL
          OR plausible_sessions_since_latest >= sessions_needed_with_holiday_allowance
        )
    ) AS retry_eligible_count,
    count(*) FILTER (
      WHERE rating_history_ready = false
    ) AS total_known_insufficient_count,
    count(*) FILTER (
      WHERE suppression_reason = 'insufficient_liquidity'
        AND in_cooldown
    ) AS durable_liquidity_suppressed_count,
    count(*) FILTER (
      WHERE suppression_reason = 'insufficient_liquidity'
        AND NOT in_cooldown
    ) AS durable_liquidity_retry_eligible_count,
    count(*) FILTER (
      WHERE suppression_reason = 'insufficient_liquidity'
    ) AS total_known_liquidity_suppression_count
  FROM evidence
`;

export const RATING_RECENT_FAILURE_REASON_REPORT_SQL = `
  WITH recent_failure_events AS (
    SELECT
      drr.started_at,
      UPPER(NULLIF(prior_failure ->> 'ticker', '')) AS ticker,
      COALESCE(NULLIF(prior_failure ->> 'reasonCode', ''), 'legacy_unclassified') AS reason_code,
      COALESCE(NULLIF(prior_failure ->> 'suppressionStage', ''), 'legacy_unclassified') AS suppression_stage
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
  ), latest_candidate_failure AS (
    SELECT DISTINCT ON (ticker)
      ticker,
      reason_code,
      suppression_stage,
      started_at
    FROM recent_failure_events
    WHERE ticker IS NOT NULL
    ORDER BY ticker, started_at DESC
  ), grouped AS (
    SELECT
      reason_code,
      suppression_stage,
      count(*)::int AS candidate_count
    FROM latest_candidate_failure
    GROUP BY reason_code, suppression_stage
  ), event_totals AS (
    SELECT count(*)::int AS event_count
    FROM recent_failure_events
  )
  SELECT
    COALESCE((SELECT count(*) FROM latest_candidate_failure), 0)::int AS total_recent_replaceable_count,
    COALESCE((SELECT event_count FROM event_totals), 0)::int AS total_recent_replaceable_event_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'reasonCode', reason_code,
          'suppressionStage', suppression_stage,
          'count', candidate_count
        )
        ORDER BY suppression_stage, reason_code
      ) FILTER (WHERE candidate_count > 0),
      '[]'::jsonb
    ) AS reason_breakdown
  FROM grouped
`;

interface CandidateSuppressionRow {
  readonly cooldown_suppressed_count: string | number;
  readonly session_gap_suppressed_count: string | number;
  readonly retry_eligible_count: string | number;
  readonly total_known_insufficient_count: string | number;
  readonly durable_liquidity_suppressed_count: string | number;
  readonly durable_liquidity_retry_eligible_count: string | number;
  readonly total_known_liquidity_suppression_count: string | number;
}

interface RecentFailureReasonRow {
  readonly total_recent_replaceable_count: string | number;
  readonly total_recent_replaceable_event_count: string | number;
  readonly reason_breakdown: readonly {
    readonly reasonCode: string;
    readonly suppressionStage: string;
    readonly count: number;
  }[] | string;
}

export interface CandidateSuppressionReasonCount {
  readonly reasonCode: string;
  readonly suppressionStage: string;
  readonly count: number;
}

export interface CandidateSuppressionReport {
  readonly cooldownSuppressedCount: number;
  readonly sessionGapSuppressedCount: number;
  readonly retryEligibleCount: number;
  readonly totalKnownInsufficientCount: number;
  readonly durableLiquiditySuppressedCount: number;
  readonly durableLiquidityRetryEligibleCount: number;
  readonly totalKnownLiquiditySuppressionCount: number;
  readonly recentReplaceableCount: number;
  readonly recentReplaceableEventCount: number;
  readonly recentReplaceableReasons: readonly CandidateSuppressionReasonCount[];
  readonly generatedAt: string;
}

function exactNonNegativeInteger(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Candidate suppression report returned invalid ${field}: ${String(value)}.`);
  }
  return parsed;
}

function normalizeReasonBreakdown(value: RecentFailureReasonRow["reason_breakdown"]): readonly CandidateSuppressionReasonCount[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error("Candidate suppression report returned a non-array reason breakdown.");
  }
  return Object.freeze(parsed.map((entry, index) => Object.freeze({
    reasonCode: String(entry.reasonCode ?? "legacy_unclassified"),
    suppressionStage: String(entry.suppressionStage ?? "legacy_unclassified"),
    count: exactNonNegativeInteger(entry.count ?? 0, `recentReplaceableReasons[${index}].count`),
  })));
}

function validateCandidateSuppressionReport(report: CandidateSuppressionReport): CandidateSuppressionReport {
  const historyPartitionTotal =
    report.cooldownSuppressedCount + report.sessionGapSuppressedCount + report.retryEligibleCount;
  if (historyPartitionTotal !== report.totalKnownInsufficientCount) {
    throw new Error(
      `Candidate suppression history partition mismatch: ${historyPartitionTotal} != ${report.totalKnownInsufficientCount}.`,
    );
  }

  const liquidityPartitionTotal =
    report.durableLiquiditySuppressedCount + report.durableLiquidityRetryEligibleCount;
  if (liquidityPartitionTotal !== report.totalKnownLiquiditySuppressionCount) {
    throw new Error(
      `Candidate suppression liquidity partition mismatch: ${liquidityPartitionTotal} != ${report.totalKnownLiquiditySuppressionCount}.`,
    );
  }

  const reasonTotal = report.recentReplaceableReasons.reduce((sum, item) => sum + item.count, 0);
  if (reasonTotal !== report.recentReplaceableCount) {
    throw new Error(
      `Candidate suppression reason total mismatch: ${reasonTotal} != ${report.recentReplaceableCount}.`,
    );
  }
  if (report.recentReplaceableEventCount < report.recentReplaceableCount) {
    throw new Error(
      `Candidate suppression event count is smaller than unique candidate count: ${report.recentReplaceableEventCount} < ${report.recentReplaceableCount}.`,
    );
  }
  return report;
}

export async function readCandidateSuppressionReport(databaseUrl: string): Promise<CandidateSuppressionReport> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const [historyResult, recentFailureResult] = await Promise.all([
      pool.query<CandidateSuppressionRow>(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL),
      pool.query<RecentFailureReasonRow>(RATING_RECENT_FAILURE_REASON_REPORT_SQL),
    ]);
    const historyRow = historyResult.rows[0];
    const recentFailureRow = recentFailureResult.rows[0];
    if (!historyRow) throw new Error("Candidate suppression report returned no history row.");
    if (!recentFailureRow) throw new Error("Candidate suppression report returned no recent-failure row.");

    const recentReplaceableReasons = normalizeReasonBreakdown(recentFailureRow.reason_breakdown);
    const report = Object.freeze({
      cooldownSuppressedCount: exactNonNegativeInteger(
        historyRow.cooldown_suppressed_count ?? 0,
        "cooldownSuppressedCount",
      ),
      sessionGapSuppressedCount: exactNonNegativeInteger(
        historyRow.session_gap_suppressed_count ?? 0,
        "sessionGapSuppressedCount",
      ),
      retryEligibleCount: exactNonNegativeInteger(
        historyRow.retry_eligible_count ?? 0,
        "retryEligibleCount",
      ),
      totalKnownInsufficientCount: exactNonNegativeInteger(
        historyRow.total_known_insufficient_count ?? 0,
        "totalKnownInsufficientCount",
      ),
      durableLiquiditySuppressedCount: exactNonNegativeInteger(
        historyRow.durable_liquidity_suppressed_count ?? 0,
        "durableLiquiditySuppressedCount",
      ),
      durableLiquidityRetryEligibleCount: exactNonNegativeInteger(
        historyRow.durable_liquidity_retry_eligible_count ?? 0,
        "durableLiquidityRetryEligibleCount",
      ),
      totalKnownLiquiditySuppressionCount: exactNonNegativeInteger(
        historyRow.total_known_liquidity_suppression_count ?? 0,
        "totalKnownLiquiditySuppressionCount",
      ),
      recentReplaceableCount: exactNonNegativeInteger(
        recentFailureRow.total_recent_replaceable_count ?? 0,
        "recentReplaceableCount",
      ),
      recentReplaceableEventCount: exactNonNegativeInteger(
        recentFailureRow.total_recent_replaceable_event_count ?? 0,
        "recentReplaceableEventCount",
      ),
      recentReplaceableReasons,
      generatedAt: new Date().toISOString(),
    });
    return validateCandidateSuppressionReport(report);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to report rating candidate suppression.");
  }

  const report = await readCandidateSuppressionReport(databaseUrl);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
