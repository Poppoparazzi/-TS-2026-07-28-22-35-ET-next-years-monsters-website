// TS: 2026-09-13 19:59 UTC

import type { DailyMarketHistory, MarketDataProvider } from "../providers/types.js";
import type { RatingBatchStore } from "./batch-store.js";
import { inspectCachedCompanyHistory } from "./cached-company-history-preflight.js";
import { buildMarketHistoryEvidence, type MarketHistoryEvidence } from "./market-history-evidence.js";

export interface DirectCompanyHistoryResult {
  readonly history: DailyMarketHistory | null;
  readonly evidence: MarketHistoryEvidence | null;
  readonly source: "cache" | "paid_refresh";
}

export async function loadDirectCompanyHistoryQuotaSafe(input: {
  readonly marketProvider: MarketDataProvider;
  readonly batchStore: RatingBatchStore;
  readonly ticker: string;
  readonly paidRefresh: () => Promise<DailyMarketHistory>;
}): Promise<DirectCompanyHistoryResult> {
  const cached = await inspectCachedCompanyHistory(
    input.marketProvider,
    input.batchStore,
    input.ticker,
  );

  if (!cached.shouldRefresh) {
    return Object.freeze({
      history: cached.history,
      evidence: cached.evidence,
      source: "cache" as const,
    });
  }

  const refreshedHistory = await input.paidRefresh();
  const refreshedEvidence = buildMarketHistoryEvidence(refreshedHistory);
  await input.batchStore.saveMarketHistoryEvidence(refreshedEvidence);

  return Object.freeze({
    history: refreshedEvidence.suppressionReason ? null : refreshedHistory,
    evidence: refreshedEvidence,
    source: "paid_refresh" as const,
  });
}
