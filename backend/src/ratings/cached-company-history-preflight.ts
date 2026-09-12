// TS: 2026-09-12 00:07 UTC

import type { DailyMarketHistory, MarketDataProvider } from "../providers/types.js";
import type { RatingBatchStore } from "./batch-store.js";
import { buildMarketHistoryEvidence, type MarketHistoryEvidence } from "./market-history-evidence.js";

export interface CachedCompanyHistoryPreflightResult {
  readonly history: DailyMarketHistory | null;
  readonly evidence: MarketHistoryEvidence | null;
  readonly shouldRefresh: boolean;
}

export async function inspectCachedCompanyHistory(
  marketProvider: MarketDataProvider,
  batchStore: RatingBatchStore,
  ticker: string,
): Promise<CachedCompanyHistoryPreflightResult> {
  if (!marketProvider.getCachedDailyHistory) {
    return Object.freeze({ history: null, evidence: null, shouldRefresh: true });
  }

  const cachedCompanyHistory = await marketProvider.getCachedDailyHistory(ticker, 300);
  if (!cachedCompanyHistory || cachedCompanyHistory.provider !== marketProvider.name) {
    return Object.freeze({ history: null, evidence: null, shouldRefresh: true });
  }

  const evidence = buildMarketHistoryEvidence(cachedCompanyHistory);

  // Staleness is a refresh condition, not durable proof that the company is ineligible.
  // Do not persist stale cache evidence as a reusable suppression or the post-claim
  // suppression guard will immediately read it back and prevent the intended refresh.
  if (evidence.suppressionReason === "stale_market_data") {
    return Object.freeze({ history: null, evidence, shouldRefresh: true });
  }

  // Persist reusable evidence for genuine history/liquidity ineligibility and for valid
  // provider-backed history. This keeps repeat paid calls suppressed where evidence is decisive.
  await batchStore.saveMarketHistoryEvidence(evidence);

  if (evidence.suppressionReason) {
    return Object.freeze({ history: null, evidence, shouldRefresh: false });
  }

  return Object.freeze({ history: cachedCompanyHistory, evidence, shouldRefresh: false });
}
