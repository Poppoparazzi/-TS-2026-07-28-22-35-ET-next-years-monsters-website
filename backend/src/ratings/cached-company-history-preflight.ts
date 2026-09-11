// TS: 2026-09-11 02:01 UTC

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
  await batchStore.saveMarketHistoryEvidence(evidence);

  if (evidence.suppressionReason === "stale_market_data") {
    return Object.freeze({ history: null, evidence, shouldRefresh: true });
  }

  if (evidence.suppressionReason) {
    return Object.freeze({ history: null, evidence, shouldRefresh: false });
  }

  return Object.freeze({ history: cachedCompanyHistory, evidence, shouldRefresh: false });
}
