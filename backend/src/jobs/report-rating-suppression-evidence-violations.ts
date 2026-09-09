// TS: 2026-09-08 21:57 ET

import pg from "pg";
import { loadConfig } from "../config.js";

const { Pool } = pg;

export const RATING_SUPPRESSION_EVIDENCE_VIOLATION_SQL = `
  WITH latest AS (
    SELECT
      company_id,
      provider,
      suppression_reason,
      usable_bar_count,
      twenty_session_average_dollar_volume,
      latest_bar_date,
      retrieved_at
    FROM market_history_evidence_latest_by_provider
    WHERE provider = $1
      AND suppression_reason IS NOT NULL
  ), violations AS (
    SELECT
      company_id,
      suppression_reason,
      CASE
        WHEN suppression_reason = 'insufficient_market_history'
          AND usable_bar_count >= 253
          THEN 'history_reason_without_history_deficit'
        WHEN suppression_reason = 'insufficient_liquidity'
          AND (
            usable_bar_count < 253
            OR twenty_session_average_dollar_volume IS NULL
            OR twenty_session_average_dollar_volume >= 1000000
          )
          THEN 'liquidity_reason_without_liquidity_failure'
        WHEN suppression_reason = 'stale_market_data'
          AND (usable_bar_count < 253 OR latest_bar_date IS NULL)
          THEN 'stale_reason_without_stale_evidence'
        WHEN suppression_reason NOT IN (
          'insufficient_market_history',
          'insufficient_liquidity',
          'stale_market_data'
        )
          THEN 'unknown_suppression_reason'
        ELSE NULL
      END AS violation_code
    FROM latest
  ), grouped AS (
    SELECT violation_code, count(*)::int AS candidate_count
    FROM violations
    WHERE violation_code IS NOT NULL
    GROUP BY violation_code
  )
  SELECT
    $1::text AS provider,
    COALESCE((SELECT count(*) FROM latest), 0)::int AS inspected_suppressed_count,
    COALESCE((SELECT count(*) FROM violations WHERE violation_code IS NOT NULL), 0)::int AS violation_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('violationCode', violation_code, 'count', candidate_count)
        ORDER BY violation_code
      ) FILTER (WHERE candidate_count > 0),
      '[]'::jsonb
    ) AS violations
  FROM grouped
`;

interface ViolationRow {
  readonly provider: string;
  readonly inspected_suppressed_count: string | number;
  readonly violation_count: string | number;
  readonly violations: readonly { readonly violationCode: string; readonly count: number }[] | string;
}

function exactNonNegativeInteger(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Suppression evidence violation report returned invalid ${field}: ${String(value)}.`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error("DATABASE_URL is required to report suppression evidence violations.");
  if (config.marketDataProvider === "unconfigured") {
    throw new Error("MARKET_DATA_PROVIDER must be configured to report provider-scoped suppression evidence violations.");
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const result = await pool.query<ViolationRow>(RATING_SUPPRESSION_EVIDENCE_VIOLATION_SQL, [
      config.marketDataProvider,
    ]);
    const row = result.rows[0];
    if (!row) throw new Error("Suppression evidence violation report returned no row.");
    const violations = typeof row.violations === "string" ? JSON.parse(row.violations) : row.violations;
    if (!Array.isArray(violations)) throw new Error("Suppression evidence violation report returned invalid violations.");
    const normalizedViolations = violations.map((entry, index) => ({
      violationCode: String(entry.violationCode),
      count: exactNonNegativeInteger(entry.count, `violations[${index}].count`),
    }));
    const violationCount = exactNonNegativeInteger(row.violation_count, "violationCount");
    const reasonTotal = normalizedViolations.reduce((sum, item) => sum + item.count, 0);
    if (reasonTotal !== violationCount) {
      throw new Error(`Suppression evidence violation partition mismatch: ${reasonTotal} != ${violationCount}.`);
    }
    process.stdout.write(`${JSON.stringify({
      provider: row.provider,
      inspectedSuppressedCount: exactNonNegativeInteger(row.inspected_suppressed_count, "inspectedSuppressedCount"),
      violationCount,
      violations: normalizedViolations,
      generatedAt: new Date().toISOString(),
    }, null, 2)}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
