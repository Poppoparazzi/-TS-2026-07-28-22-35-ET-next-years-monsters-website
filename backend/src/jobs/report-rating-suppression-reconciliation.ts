// TS: 2026-09-06 02:03 ET

import pg from "pg";

const { Pool } = pg;

export const RATING_SUPPRESSION_RECONCILIATION_SQL = `
  WITH persisted AS (
    SELECT
      UPPER(c.ticker) AS ticker,
      COALESCE(NULLIF(mhe.suppression_reason, ''), 'unclassified') AS reason_code,
      'persisted_market_history'::text AS suppression_stage,
      mhe.retrieved_at AS observed_at,
      1 AS source_priority
    FROM market_history_evidence_latest mhe
    INNER JOIN companies c ON c.id = mhe.company_id
    WHERE mhe.rating_history_ready = false
      AND CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '30 days'
  ), recent_failure_events AS (
    SELECT
      UPPER(NULLIF(prior_failure ->> 'ticker', '')) AS ticker,
      COALESCE(NULLIF(prior_failure ->> 'reasonCode', ''), 'legacy_unclassified') AS reason_code,
      COALESCE(NULLIF(prior_failure ->> 'suppressionStage', ''), 'legacy_unclassified') AS suppression_stage,
      drr.started_at AS observed_at,
      2 AS source_priority
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
      reason_code,
      suppression_stage,
      observed_at,
      source_priority
    FROM recent_failure_events
    WHERE ticker IS NOT NULL
    ORDER BY ticker, observed_at DESC
  ), candidates AS (
    SELECT * FROM persisted
    UNION ALL
    SELECT * FROM latest_recent_failure
  ), authoritative AS (
    SELECT DISTINCT ON (ticker)
      ticker,
      reason_code,
      suppression_stage,
      observed_at,
      source_priority
    FROM candidates
    ORDER BY ticker, source_priority ASC, observed_at DESC
  ), grouped AS (
    SELECT
      reason_code,
      suppression_stage,
      count(*)::int AS candidate_count
    FROM authoritative
    GROUP BY reason_code, suppression_stage
  )
  SELECT
    COALESCE((SELECT count(*) FROM authoritative), 0)::int AS unique_suppressed_candidate_count,
    COALESCE((SELECT count(*) FROM authoritative WHERE source_priority = 1), 0)::int AS persisted_authoritative_count,
    COALESCE((SELECT count(*) FROM authoritative WHERE source_priority = 2), 0)::int AS recent_authoritative_count,
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

interface ReconciliationRow {
  readonly unique_suppressed_candidate_count: string | number;
  readonly persisted_authoritative_count: string | number;
  readonly recent_authoritative_count: string | number;
  readonly reason_breakdown: readonly {
    readonly reasonCode: string;
    readonly suppressionStage: string;
    readonly count: number;
  }[] | string;
}

export interface RatingSuppressionReconciliationReason {
  readonly reasonCode: string;
  readonly suppressionStage: string;
  readonly count: number;
}

export interface RatingSuppressionReconciliationReport {
  readonly uniqueSuppressedCandidateCount: number;
  readonly persistedAuthoritativeCount: number;
  readonly recentAuthoritativeCount: number;
  readonly reasons: readonly RatingSuppressionReconciliationReason[];
  readonly generatedAt: string;
}

function exactNonNegativeInteger(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Rating suppression reconciliation returned invalid ${field}: ${String(value)}.`);
  }
  return parsed;
}

function normalizeReasons(value: ReconciliationRow["reason_breakdown"]): readonly RatingSuppressionReconciliationReason[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error("Rating suppression reconciliation returned a non-array reason breakdown.");
  }
  return Object.freeze(parsed.map((entry, index) => Object.freeze({
    reasonCode: String(entry.reasonCode ?? "legacy_unclassified"),
    suppressionStage: String(entry.suppressionStage ?? "legacy_unclassified"),
    count: exactNonNegativeInteger(entry.count ?? 0, `reasons[${index}].count`),
  })));
}

function validate(report: RatingSuppressionReconciliationReport): RatingSuppressionReconciliationReport {
  if (report.persistedAuthoritativeCount + report.recentAuthoritativeCount !== report.uniqueSuppressedCandidateCount) {
    throw new Error("Rating suppression reconciliation source partition mismatch.");
  }
  const reasonTotal = report.reasons.reduce((sum, item) => sum + item.count, 0);
  if (reasonTotal !== report.uniqueSuppressedCandidateCount) {
    throw new Error("Rating suppression reconciliation reason partition mismatch.");
  }
  return report;
}

export async function readRatingSuppressionReconciliationReport(
  databaseUrl: string,
): Promise<RatingSuppressionReconciliationReport> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const result = await pool.query<ReconciliationRow>(RATING_SUPPRESSION_RECONCILIATION_SQL);
    const row = result.rows[0];
    if (!row) throw new Error("Rating suppression reconciliation returned no row.");

    const report = Object.freeze({
      uniqueSuppressedCandidateCount: exactNonNegativeInteger(
        row.unique_suppressed_candidate_count ?? 0,
        "uniqueSuppressedCandidateCount",
      ),
      persistedAuthoritativeCount: exactNonNegativeInteger(
        row.persisted_authoritative_count ?? 0,
        "persistedAuthoritativeCount",
      ),
      recentAuthoritativeCount: exactNonNegativeInteger(
        row.recent_authoritative_count ?? 0,
        "recentAuthoritativeCount",
      ),
      reasons: normalizeReasons(row.reason_breakdown),
      generatedAt: new Date().toISOString(),
    });
    return validate(report);
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to reconcile rating suppression reasons.");
  }

  const report = await readRatingSuppressionReconciliationReport(databaseUrl);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
