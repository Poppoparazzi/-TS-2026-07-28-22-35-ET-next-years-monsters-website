// TS: 2026-08-30 07:58 ET

import type { PoolClient } from "pg";
import {
  MINIMUM_RATING_HISTORY_BARS,
  type MarketHistoryEvidence,
} from "../ratings/market-history-evidence.js";

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
  if (!Number.isFinite(Date.parse(evidence.retrievedAt))) {
    throw new Error("market_history_evidence_invalid_retrieved_at");
  }
  if (!evidence.feedDisclosure.trim()) {
    throw new Error("market_history_evidence_disclosure_required");
  }
}

function classifyMarketHistoryEvidence(evidence: MarketHistoryEvidence): {
  ratingEligibilityCode: "eligible" | "insufficient_market_history";
  suppressionReason: "insufficient_market_history" | null;
} {
  if (evidence.usableBarCount >= MINIMUM_RATING_HISTORY_BARS) {
    return {
      ratingEligibilityCode: "eligible",
      suppressionReason: null,
    };
  }
  return {
    ratingEligibilityCode: "insufficient_market_history",
    suppressionReason: "insufficient_market_history",
  };
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
        retrieved_at,
        feed_disclosure,
        rating_eligibility_code,
        suppression_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (company_id, provider) DO UPDATE SET
        usable_bar_count = EXCLUDED.usable_bar_count,
        latest_bar_date = EXCLUDED.latest_bar_date,
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
      evidence.retrievedAt,
      evidence.feedDisclosure,
      classification.ratingEligibilityCode,
      classification.suppressionReason,
    ],
  );
}
