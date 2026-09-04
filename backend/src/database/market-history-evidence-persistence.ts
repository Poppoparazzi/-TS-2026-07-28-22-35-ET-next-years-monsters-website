// TS: 2026-09-04 19:01 ET

import type { PoolClient } from "pg";
import {
  MINIMUM_RATING_HISTORY_BARS,
  type MarketHistoryEvidence,
} from "../ratings/market-history-evidence.js";

export const MARKET_HISTORY_SUPPRESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const STALE_MARKET_DATA_SUPPRESSION_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
export const MARKET_HISTORY_SUPPRESSION_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const MARKET_DATA_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

type MarketHistorySuppressionReason = "insufficient_market_history" | "insufficient_liquidity" | "stale_market_data";
type MarketHistoryEligibilityCode = "eligible" | MarketHistorySuppressionReason;

export interface PersistedMarketHistorySuppression {
  readonly ratingEligibilityCode: MarketHistorySuppressionReason;
  readonly suppressionReason: MarketHistorySuppressionReason;
  readonly usableBarCount: number;
  readonly retrievedAt: string;
}

interface PersistedMarketHistorySuppressionRow {
  readonly rating_eligibility_code: MarketHistorySuppressionReason;
  readonly suppression_reason: MarketHistorySuppressionReason;
  readonly usable_bar_count: string | number;
  readonly retrieved_at: Date | string;
}

function assertPersistableMarketHistoryEvidence(
  companyId: string,
  evidence: MarketHistoryEvidence,
): void {
  if (!companyId.trim()) {
    throw new Error("market_history_evidence_company_id_required");
  }
  if (!evidence.provider.trim()) {
    throw new Error("market_history_evidence_provider_required");
  }
  if (!Number.isInteger(evidence.usableBarCount) || evidence.usableBarCount < 0) {
    throw new Error("market_history_evidence_invalid_usable_bar_count");
  }
  const hasUsableBars = evidence.usableBarCount > 0;
  const hasLatestBarDate = evidence.latestBarDate !== null;
  if (hasUsableBars !== hasLatestBarDate || (
    evidence.latestBarDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(evidence.latestBarDate)
  )) {
    throw new Error("market_history_evidence_invalid_latest_bar_date");
  }
  if (
    evidence.twentySessionAverageDollarVolume !== undefined &&
    evidence.twentySessionAverageDollarVolume !== null &&
    (!Number.isFinite(evidence.twentySessionAverageDollarVolume) || evidence.twentySessionAverageDollarVolume < 0)
  ) {
    throw new Error("market_history_evidence_invalid_liquidity");
  }
  if (evidence.suppressionReason === "insufficient_liquidity" && (
    evidence.usableBarCount < MINIMUM_RATING_HISTORY_BARS ||
    evidence.twentySessionAverageDollarVolume === undefined ||
    evidence.twentySessionAverageDollarVolume === null ||
    evidence.twentySessionAverageDollarVolume >= 1_000_000
  )) {
    throw new Error("market_history_evidence_invalid_liquidity_suppression");
  }
  const retrievedAtMs = Date.parse(evidence.retrievedAt);
  if (!Number.isFinite(retrievedAtMs)) {
    throw new Error("market_history_evidence_invalid_retrieved_at");
  }
  if (evidence.suppressionReason === "stale_market_data") {
    const latestBarMs = evidence.latestBarDate === null ? Number.NaN : Date.parse(evidence.latestBarDate);
    if (
      evidence.usableBarCount < MINIMUM_RATING_HISTORY_BARS ||
      !Number.isFinite(latestBarMs) ||
      retrievedAtMs - latestBarMs <= MARKET_DATA_STALE_AFTER_MS
    ) {
      throw new Error("market_history_evidence_invalid_stale_market_data_suppression");
    }
  }
  if (!evidence.feedDisclosure.trim()) {
    throw new Error("market_history_evidence_disclosure_required");
  }
}

function classifyMarketHistoryEvidence(evidence: MarketHistoryEvidence): {
  ratingEligibilityCode: MarketHistoryEligibilityCode;
  suppressionReason: MarketHistorySuppressionReason | null;
} {
  if (evidence.usableBarCount < MINIMUM_RATING_HISTORY_BARS) {
    return {
      ratingEligibilityCode: "insufficient_market_history",
      suppressionReason: "insufficient_market_history",
    };
  }
  if (evidence.suppressionReason === "insufficient_liquidity") {
    return {
      ratingEligibilityCode: "insufficient_liquidity",
      suppressionReason: "insufficient_liquidity",
    };
  }
  if (evidence.suppressionReason === "stale_market_data") {
    return {
      ratingEligibilityCode: "stale_market_data",
      suppressionReason: "stale_market_data",
    };
  }
  return {
    ratingEligibilityCode: "eligible",
    suppressionReason: null,
  };
}

function parsePersistedSuppressionRow(
  row: PersistedMarketHistorySuppressionRow | undefined,
  nowMs: number,
): PersistedMarketHistorySuppression | null {
  if (!row) return null;

  const usableBarCount = Number(row.usable_bar_count);
  const retrievedAt = row.retrieved_at instanceof Date
    ? row.retrieved_at.toISOString()
    : new Date(row.retrieved_at).toISOString();
  const retrievedAtMs = Date.parse(retrievedAt);
  if (!Number.isInteger(usableBarCount) || usableBarCount < 0 || !Number.isFinite(retrievedAtMs)) {
    throw new Error("market_history_evidence_invalid_persisted_suppression");
  }
  const validSuppressionPair = (
    row.rating_eligibility_code === "insufficient_market_history" &&
    row.suppression_reason === "insufficient_market_history"
  ) || (
    row.rating_eligibility_code === "insufficient_liquidity" &&
    row.suppression_reason === "insufficient_liquidity"
  ) || (
    row.rating_eligibility_code === "stale_market_data" &&
    row.suppression_reason === "stale_market_data"
  );
  if (!validSuppressionPair) {
    throw new Error("market_history_evidence_invalid_persisted_suppression");
  }

  if (!Number.isFinite(nowMs)) return null;
  const ageMs = nowMs - retrievedAtMs;
  const maximumAgeMs = row.suppression_reason === "stale_market_data"
    ? STALE_MARKET_DATA_SUPPRESSION_MAX_AGE_MS
    : MARKET_HISTORY_SUPPRESSION_MAX_AGE_MS;
  if (
    ageMs < -MARKET_HISTORY_SUPPRESSION_FUTURE_TOLERANCE_MS ||
    ageMs > maximumAgeMs
  ) {
    return null;
  }

  return Object.freeze({
    ratingEligibilityCode: row.rating_eligibility_code,
    suppressionReason: row.suppression_reason,
    usableBarCount,
    retrievedAt,
  });
}

export async function getPersistedMarketHistorySuppression(
  client: Pick<PoolClient, "query">,
  companyId: string,
  provider: string,
  nowMs = Date.now(),
): Promise<PersistedMarketHistorySuppression | null> {
  const normalizedCompanyId = companyId.trim();
  const normalizedProvider = provider.trim();
  if (!normalizedCompanyId) throw new Error("market_history_evidence_company_id_required");
  if (!normalizedProvider) throw new Error("market_history_evidence_provider_required");

  const result = await client.query<PersistedMarketHistorySuppressionRow>(
    `
      SELECT
        rating_eligibility_code,
        suppression_reason,
        usable_bar_count,
        retrieved_at
      FROM market_history_evidence
      WHERE company_id = $1
        AND provider = $2
        AND suppression_reason IS NOT NULL
      ORDER BY retrieved_at DESC
      LIMIT 1
    `,
    [normalizedCompanyId, normalizedProvider],
  );

  return parsePersistedSuppressionRow(result.rows[0], nowMs);
}

export async function getPersistedMarketHistorySuppressionByTicker(
  client: Pick<PoolClient, "query">,
  ticker: string,
  provider: string,
  nowMs = Date.now(),
): Promise<PersistedMarketHistorySuppression | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const normalizedProvider = provider.trim();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalizedTicker)) {
    throw new Error("market_history_evidence_ticker_required");
  }
  if (!normalizedProvider) throw new Error("market_history_evidence_provider_required");

  const result = await client.query<PersistedMarketHistorySuppressionRow>(
    `
      SELECT
        mhe.rating_eligibility_code,
        mhe.suppression_reason,
        mhe.usable_bar_count,
        mhe.retrieved_at
      FROM market_history_evidence mhe
      INNER JOIN companies c ON c.id = mhe.company_id
      WHERE c.ticker = $1
        AND mhe.provider = $2
        AND mhe.suppression_reason IS NOT NULL
      ORDER BY mhe.retrieved_at DESC
      LIMIT 1
    `,
    [normalizedTicker, normalizedProvider],
  );

  return parsePersistedSuppressionRow(result.rows[0], nowMs);
}

export async function upsertMarketHistoryEvidence(
  client: Pick<PoolClient, "query">,
  companyId: string,
  evidence: MarketHistoryEvidence,
): Promise<void> {
  assertPersistableMarketHistoryEvidence(companyId, evidence);
  const classification = classifyMarketHistoryEvidence(evidence);

  await client.query(
    `
      INSERT INTO market_history_evidence (
        company_id,
        provider,
        usable_bar_count,
        latest_bar_date,
        twenty_session_average_dollar_volume,
        retrieved_at,
        feed_disclosure,
        rating_eligibility_code,
        suppression_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (company_id, provider) DO UPDATE SET
        usable_bar_count = EXCLUDED.usable_bar_count,
        latest_bar_date = EXCLUDED.latest_bar_date,
        twenty_session_average_dollar_volume = EXCLUDED.twenty_session_average_dollar_volume,
        retrieved_at = EXCLUDED.retrieved_at,
        feed_disclosure = EXCLUDED.feed_disclosure,
        rating_eligibility_code = EXCLUDED.rating_eligibility_code,
        suppression_reason = EXCLUDED.suppression_reason
      WHERE EXCLUDED.retrieved_at >= market_history_evidence.retrieved_at
    `,
    [
      companyId,
      evidence.provider,
      evidence.usableBarCount,
      evidence.latestBarDate,
      evidence.twentySessionAverageDollarVolume ?? null,
      evidence.retrievedAt,
      evidence.feedDisclosure,
      classification.ratingEligibilityCode,
      classification.suppressionReason,
    ],
  );
}
