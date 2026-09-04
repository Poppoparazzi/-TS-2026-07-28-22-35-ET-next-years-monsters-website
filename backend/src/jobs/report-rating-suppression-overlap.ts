// TS: 2026-09-04 14:57 ET

import pg from "pg";

const { Pool } = pg;

export const RATING_SUPPRESSION_OVERLAP_REPORT_SQL = `
  WITH durable_suppressed AS (
    SELECT DISTINCT UPPER(c.ticker) AS ticker
    FROM market_history_evidence_latest mhe
    INNER JOIN companies c ON c.id = mhe.company_id
    WHERE CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '30 days'
      AND (
        mhe.rating_history_ready = false
        OR mhe.suppression_reason = 'insufficient_liquidity'
      )
  ), recent_failure_events AS (
    SELECT
      drr.started_at,
      UPPER(NULLIF(prior_failure ->> 'ticker', '')) AS ticker
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
  ), latest_recent_failure AS (
    SELECT DISTINCT ON (ticker)
      ticker,
      started_at
    FROM recent_failure_events
    WHERE ticker IS NOT NULL
    ORDER BY ticker, started_at DESC
  ), combined AS (
    SELECT ticker, true AS durable, false AS recent
    FROM durable_suppressed
    UNION ALL
    SELECT ticker, false AS durable, true AS recent
    FROM latest_recent_failure
  ), per_candidate AS (
    SELECT
      ticker,
      bool_or(durable) AS durable,
      bool_or(recent) AS recent
    FROM combined
    GROUP BY ticker
  )
  SELECT
    count(*) FILTER (WHERE durable)::int AS durable_candidate_count,
    count(*) FILTER (WHERE recent)::int AS recent_machine_reason_candidate_count,
    count(*) FILTER (WHERE durable AND recent)::int AS overlap_candidate_count,
    count(*) FILTER (WHERE durable AND NOT recent)::int AS durable_only_candidate_count,
    count(*) FILTER (WHERE recent AND NOT durable)::int AS recent_only_candidate_count,
    count(*)::int AS unique_candidate_count
  FROM per_candidate
`;

interface OverlapRow {
  readonly durable_candidate_count: string | number;
  readonly recent_machine_reason_candidate_count: string | number;
  readonly overlap_candidate_count: string | number;
  readonly durable_only_candidate_count: string | number;
  readonly recent_only_candidate_count: string | number;
  readonly unique_candidate_count: string | number;
}

export interface RatingSuppressionOverlapReport {
  readonly durableCandidateCount: number;
  readonly recentMachineReasonCandidateCount: number;
  readonly overlapCandidateCount: number;
  readonly durableOnlyCandidateCount: number;
  readonly recentOnlyCandidateCount: number;
  readonly uniqueCandidateCount: number;
  readonly generatedAt: string;
}

function exactNonNegativeInteger(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Rating suppression overlap report returned invalid ${field}: ${String(value)}.`);
  }
  return parsed;
}

function validate(report: RatingSuppressionOverlapReport): RatingSuppressionOverlapReport {
  if (report.durableOnlyCandidateCount + report.overlapCandidateCount !== report.durableCandidateCount) {
    throw new Error("Rating suppression overlap durable partition mismatch.");
  }
  if (report.recentOnlyCandidateCount + report.overlapCandidateCount !== report.recentMachineReasonCandidateCount) {
    throw new Error("Rating suppression overlap recent-reason partition mismatch.");
  }
  if (report.durableOnlyCandidateCount + report.recentOnlyCandidateCount + report.overlapCandidateCount !== report.uniqueCandidateCount) {
    throw new Error("Rating suppression overlap unique-candidate partition mismatch.");
  }
  return report;
}

export async function readRatingSuppressionOverlapReport(databaseUrl: string): Promise<RatingSuppressionOverlapReport> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const result = await pool.query<OverlapRow>(RATING_SUPPRESSION_OVERLAP_REPORT_SQL);
    const row = result.rows[0];
    if (!row) throw new Error("Rating suppression overlap report returned no row.");

    return validate(Object.freeze({
      durableCandidateCount: exactNonNegativeInteger(row.durable_candidate_count ?? 0, "durableCandidateCount"),
      recentMachineReasonCandidateCount: exactNonNegativeInteger(
        row.recent_machine_reason_candidate_count ?? 0,
        "recentMachineReasonCandidateCount",
      ),
      overlapCandidateCount: exactNonNegativeInteger(row.overlap_candidate_count ?? 0, "overlapCandidateCount"),
      durableOnlyCandidateCount: exactNonNegativeInteger(row.durable_only_candidate_count ?? 0, "durableOnlyCandidateCount"),
      recentOnlyCandidateCount: exactNonNegativeInteger(row.recent_only_candidate_count ?? 0, "recentOnlyCandidateCount"),
      uniqueCandidateCount: exactNonNegativeInteger(row.unique_candidate_count ?? 0, "uniqueCandidateCount"),
      generatedAt: new Date().toISOString(),
    }));
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to report rating suppression overlap.");
  }

  const report = await readRatingSuppressionOverlapReport(databaseUrl);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
