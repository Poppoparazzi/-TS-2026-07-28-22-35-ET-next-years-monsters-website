// TS: 2026-09-14 06:05 UTC

import type { DailyMarketHistory, MarketDataProvider } from "../providers/types.js";
import type { RatingBatchStore } from "./batch-store.js";
import { inspectCachedCompanyHistory } from "./cached-company-history-preflight.js";
import { buildMarketHistoryEvidence, type MarketHistoryEvidence } from "./market-history-evidence.js";

export interface DirectCompanyHistoryResult {
  readonly history: DailyMarketHistory | null;
  readonly evidence: MarketHistoryEvidence | null;
  readonly source: "cache" | "paid_refresh";
}

export type DirectCompanyHistoryLeaseResult =
  | {
      readonly status: "ready";
      readonly history: DailyMarketHistory;
      readonly evidence: MarketHistoryEvidence | null;
      readonly source: "cache" | "paid_refresh";
      readonly claimAcquired: boolean;
    }
  | {
      readonly status: "suppressed";
      readonly history: null;
      readonly evidence: MarketHistoryEvidence | null;
      readonly source: "cache" | "paid_refresh" | "persisted_suppression";
      readonly claimAcquired: false;
      readonly eligibilityCode: string;
      readonly suppressionReason: string;
    }
  | {
      readonly status: "in_progress";
      readonly history: null;
      readonly evidence: null;
      readonly source: null;
      readonly claimAcquired: false;
    }
  | {
      readonly status: "persistence_unavailable";
      readonly history: null;
      readonly evidence: null;
      readonly source: null;
      readonly claimAcquired: false;
      readonly eligibilityCode: "market_history_persistence_unavailable";
      readonly suppressionReason: string;
    };

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

export async function loadDirectCompanyHistoryWithLease(input: {
  readonly marketProvider: MarketDataProvider;
  readonly batchStore: RatingBatchStore;
  readonly ticker: string;
  readonly runId: string;
}): Promise<DirectCompanyHistoryLeaseResult> {
  if (!input.marketProvider.getDailyHistory) {
    throw new Error("Historical market-data provider is unavailable.");
  }

  const cached = await inspectCachedCompanyHistory(
    input.marketProvider,
    input.batchStore,
    input.ticker,
  );

  if (!cached.shouldRefresh) {
    if (cached.evidence?.suppressionReason) {
      return Object.freeze({
        status: "suppressed" as const,
        history: null,
        evidence: cached.evidence,
        source: "cache" as const,
        claimAcquired: false as const,
        eligibilityCode: cached.evidence.suppressionReason,
        suppressionReason: cached.evidence.suppressionReason,
      });
    }

    if (!cached.history) {
      throw new Error("Reusable company market history was expected but unavailable.");
    }

    return Object.freeze({
      status: "ready" as const,
      history: cached.history,
      evidence: cached.evidence,
      source: "cache" as const,
      claimAcquired: false,
    });
  }

  if (!input.batchStore.configured) {
    return Object.freeze({
      status: "persistence_unavailable" as const,
      history: null,
      evidence: null,
      source: null,
      claimAcquired: false as const,
      eligibilityCode: "market_history_persistence_unavailable" as const,
      suppressionReason: "Paid market history was not requested because durable market-history evidence storage and lease protection are unavailable.",
    });
  }

  let claimAcquired = false;
  claimAcquired = await input.batchStore.tryClaimMarketHistoryRequest(
    input.ticker,
    input.marketProvider.name,
    input.runId,
  );

  if (!claimAcquired) {
    return Object.freeze({
      status: "in_progress" as const,
      history: null,
      evidence: null,
      source: null,
      claimAcquired: false as const,
    });
  }

  const postClaimSuppression = await input.batchStore.getReusableMarketHistorySuppression(
    input.ticker,
    input.marketProvider.name,
  );
  if (postClaimSuppression) {
    await input.batchStore.releaseMarketHistoryRequestClaim(
      input.ticker,
      input.marketProvider.name,
      input.runId,
    );
    return Object.freeze({
      status: "suppressed" as const,
      history: null,
      evidence: null,
      source: "persisted_suppression" as const,
      claimAcquired: false as const,
      eligibilityCode: postClaimSuppression.ratingEligibilityCode,
      suppressionReason: postClaimSuppression.suppressionReason,
    });
  }

  let paidHistoryFetched = false;
  try {
    const refreshedHistory = await input.marketProvider.getDailyHistory(input.ticker, 300);
    paidHistoryFetched = true;
    const refreshedEvidence = buildMarketHistoryEvidence(refreshedHistory);
    await input.batchStore.saveMarketHistoryEvidence(refreshedEvidence);

    if (refreshedEvidence.suppressionReason) {
      if (claimAcquired) {
        await input.batchStore.releaseMarketHistoryRequestClaim(
          input.ticker,
          input.marketProvider.name,
          input.runId,
        );
      }
      return Object.freeze({
        status: "suppressed" as const,
        history: null,
        evidence: refreshedEvidence,
        source: "paid_refresh" as const,
        claimAcquired: false as const,
        eligibilityCode: refreshedEvidence.suppressionReason,
        suppressionReason: refreshedEvidence.suppressionReason,
      });
    }

    return Object.freeze({
      status: "ready" as const,
      history: refreshedHistory,
      evidence: refreshedEvidence,
      source: "paid_refresh" as const,
      claimAcquired,
    });
  } catch (error) {
    if (claimAcquired && !paidHistoryFetched) {
      await input.batchStore.releaseMarketHistoryRequestClaim(
        input.ticker,
        input.marketProvider.name,
        input.runId,
      ).catch(() => undefined);
    }
    throw error;
  }
}
