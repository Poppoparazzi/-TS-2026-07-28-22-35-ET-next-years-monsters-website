// TS: 2026-08-29 00:59 ET

import pg from "pg";

const { Pool } = pg;

export const RATING_CANDIDATE_SUPPRESSION_REPORT_SQL = `
  WITH insufficient AS (
    SELECT
      mhe.company_id,
      mhe.usable_bar_count,
      mhe.latest_bar_date,
      mhe.retrieved_at,
      CURRENT_TIMESTAMP < mhe.retrieved_at + INTERVAL '7 days' AS in_cooldown,
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
    WHERE mhe.rating_history_ready = false
  )
  SELECT
    count(*) FILTER (WHERE in_cooldown) AS cooldown_suppressed_count,
    count(*) FILTER (
      WHERE NOT in_cooldown
        AND latest_bar_date IS NOT NULL
        AND plausible_sessions_since_latest < sessions_needed_with_holiday_allowance
    ) AS session_gap_suppressed_count,
    count(*) FILTER (
      WHERE NOT in_cooldown
        AND (
          latest_bar_date IS NULL
          OR plausible_sessions_since_latest >= sessions_needed_with_holiday_allowance
        )
    ) AS retry_eligible_count,
    count(*) AS total_known_insufficient_count
  FROM insufficient
`;

interface CandidateSuppressionRow {
  readonly cooldown_suppressed_count: string | number;
  readonly session_gap_suppressed_count: string | number;
  readonly retry_eligible_count: string | number;
  readonly total_known_insufficient_count: string | number;
}

export interface CandidateSuppressionReport {
  readonly cooldownSuppressedCount: number;
  readonly sessionGapSuppressedCount: number;
  readonly retryEligibleCount: number;
  readonly totalKnownInsufficientCount: number;
  readonly generatedAt: string;
}

export async function readCandidateSuppressionReport(databaseUrl: string): Promise<CandidateSuppressionReport> {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const result = await pool.query<CandidateSuppressionRow>(RATING_CANDIDATE_SUPPRESSION_REPORT_SQL);
    const row = result.rows[0];
    if (!row) throw new Error("Candidate suppression report returned no row.");

    return Object.freeze({
      cooldownSuppressedCount: Number(row.cooldown_suppressed_count ?? 0),
      sessionGapSuppressedCount: Number(row.session_gap_suppressed_count ?? 0),
      retryEligibleCount: Number(row.retry_eligible_count ?? 0),
      totalKnownInsufficientCount: Number(row.total_known_insufficient_count ?? 0),
      generatedAt: new Date().toISOString(),
    });
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
