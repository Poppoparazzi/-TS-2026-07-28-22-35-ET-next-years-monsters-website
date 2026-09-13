// TS: 2026-09-13 07:05 UTC

import pg from "pg";
import { isProtectedCompany } from "../policy/protected-stocks.js";
import { MONSTER_RATING_ENGINE_VERSION } from "./engine-v1.js";

const { Pool } = pg;

interface PilotRow {
  readonly is_pilot: boolean;
}

export interface DirectSecSuppressionInput {
  readonly databaseUrl: string;
  readonly ticker: string;
  readonly provider: string;
  readonly reason: string;
  readonly reasonCode: "unsupported_security_type";
  readonly suppressionStage: "sec_preflight";
}

export async function persistDirectSecSuppression(input: DirectSecSuppressionInput): Promise<void> {
  const pool = new Pool({
    connectionString: input.databaseUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
  });

  try {
    const ticker = input.ticker.trim().toUpperCase();
    const companyResult = await pool.query<PilotRow>(
      `SELECT is_pilot FROM companies WHERE ticker = $1 LIMIT 1`,
      [ticker],
    );
    const protectedCandidate = isProtectedCompany(
      ticker,
      companyResult.rows[0]?.is_pilot === true,
    );
    const failure = {
      ticker,
      reason: input.reason,
      reasonCode: input.reasonCode,
      suppressionStage: input.suppressionStage,
    };
    const metadata = {
      ratingVersion: MONSTER_RATING_ENGINE_VERSION,
      rollout: "direct_rating_sec_preflight",
      protectedPolicy: "must_repair",
      ordinaryFailurePolicy: "replace_from_reserve",
      protectedMustRepair: protectedCandidate ? [failure] : [],
      replaceable: protectedCandidate ? [] : [failure],
    };

    await pool.query(
      `
        INSERT INTO data_refresh_runs (
          refresh_type,
          provider,
          status,
          requested_count,
          succeeded_count,
          failed_count,
          completed_at,
          failure_summary,
          metadata
        )
        VALUES ('ratings', $1, 'partial', 1, 0, 1, CURRENT_TIMESTAMP, $2, $3::jsonb)
      `,
      [input.provider, input.reason, JSON.stringify(metadata)],
    );
  } finally {
    await pool.end();
  }
}
