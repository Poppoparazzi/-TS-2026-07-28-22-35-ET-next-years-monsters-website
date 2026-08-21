// TS: 2026-08-21 15:16 ET

import type { PersistenceStore } from "../database/persistence.js";
import type { DailyMarketHistory, MarketDataProvider } from "../providers/types.js";
import { calculateMonsterRatingV1 } from "../ratings/engine-v1.js";
import {
  buildProductionRatingInput,
  buildPublishableRating,
  quoteFromDailyHistory,
} from "../ratings/input-builder.js";
import type {
  RatingBatchAccounting,
  RatingBatchStore,
} from "../ratings/batch-store.js";
import type { SecDataProvider } from "../sec/types.js";

export interface RatingBatchDependencies {
  readonly marketProvider: MarketDataProvider;
  readonly secProvider: SecDataProvider;
  readonly persistenceStore: PersistenceStore;
  readonly batchStore: RatingBatchStore;
}

export interface RatingBatchOptions {
  readonly targetCount?: number;
  readonly candidateLimit?: number;
  readonly marketRequestDelayMs?: number;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function providerLimitReached(message: string): boolean {
  return /rate limit|api credits|credit limit|too many requests|quota/i.test(message);
}

function boundedDelay(value: number | undefined): number {
  const parsed = Math.trunc(value ?? 0);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 60_000) : 0;
}

function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runRatingBatch(
  dependencies: RatingBatchDependencies,
  options: RatingBatchOptions = {},
): Promise<RatingBatchAccounting> {
  const targetCount = Math.min(Math.max(Math.trunc(options.targetCount ?? 500), 1), 1_000);
  const candidateLimit = Math.min(
    Math.max(Math.trunc(options.candidateLimit ?? Math.max(targetCount * 2, 1_000)), targetCount),
    5_000,
  );
  const marketRequestDelayMs = boundedDelay(options.marketRequestDelayMs);
  const { marketProvider, secProvider, persistenceStore, batchStore } = dependencies;
  if (!marketProvider.configured || !marketProvider.getDailyHistory) {
    throw new Error("The licensed historical market-data provider is not configured.");
  }
  if (!secProvider.configured || !persistenceStore.configured || !batchStore.configured) {
    throw new Error("The SEC provider and production database are required for rating batches.");
  }

  let lastMarketRequestStartedAt = 0;
  const getPacedHistory = async (symbol: string, outputSize: number): Promise<DailyMarketHistory> => {
    const elapsed = Date.now() - lastMarketRequestStartedAt;
    const waitMs = lastMarketRequestStartedAt === 0 ? 0 : Math.max(0, marketRequestDelayMs - elapsed);
    if (waitMs > 0) await sleep(waitMs);
    lastMarketRequestStartedAt = Date.now();
    return marketProvider.getDailyHistory!(symbol, outputSize);
  };

  const candidates = await batchStore.listCandidates(candidateLimit);
  const runId = await batchStore.startRun(targetCount, marketProvider.name);
  const ratedTickers: string[] = [];
  const protectedMustRepair: { ticker: string; reason: string }[] = [];
  const replaceable: { ticker: string; reason: string }[] = [];
  let examinedCount = 0;
  let stoppedReason: string | null = null;
  let benchmarkHistory: DailyMarketHistory;

  try {
    benchmarkHistory = await getPacedHistory("SPY", 300);
  } catch (error) {
    const accounting: RatingBatchAccounting = Object.freeze({
      targetCount,
      candidateLimit,
      totalCandidatesExamined: 0,
      ratedCount: 0,
      protectedMustRepairCount: 0,
      replaceableCount: 0,
      replacementsAttempted: 0,
      finalUsableUniverse: 0,
      protectedMustRepair: Object.freeze([]),
      replaceable: Object.freeze([]),
      ratedTickers: Object.freeze([]),
      stoppedReason: `Benchmark market history could not be loaded: ${reason(error)}`,
      completedAt: new Date().toISOString(),
    });
    await batchStore.finishRun(runId, accounting);
    return accounting;
  }

  for (const candidate of candidates) {
    if (ratedTickers.length >= targetCount) break;
    examinedCount += 1;
    try {
      const [company, facts, filings, history] = await Promise.all([
        secProvider.getCompany(candidate.ticker),
        secProvider.getCompanyFacts(candidate.ticker),
        secProvider.getRecentFilings(candidate.ticker, 1),
        getPacedHistory(candidate.ticker, 300),
      ]);
      const calculatedAt = new Date().toISOString();
      const rating = calculateMonsterRatingV1(buildProductionRatingInput({
        company,
        facts,
        companyHistory: history,
        benchmarkHistory,
        calculatedAt,
      }));
      if (!rating.eligible) {
        const failure = { ticker: candidate.ticker, reason: rating.reasons[0]?.message ?? rating.summary };
        if (candidate.isProtected) protectedMustRepair.push(failure);
        else replaceable.push(failure);
        continue;
      }

      const quote = quoteFromDailyHistory(company, history);
      const publishableRating = buildPublishableRating({
        rating,
        facts,
        filings,
        quote,
        secProviderName: secProvider.name,
      });
      await persistenceStore.saveSecCompany(company);
      await persistenceStore.saveSecFilings(company, filings);
      await persistenceStore.saveQuote(quote);
      if (!persistenceStore.saveRating) throw new Error("Rating persistence is unavailable.");
      await persistenceStore.saveRating(publishableRating);
      ratedTickers.push(candidate.ticker);
    } catch (error) {
      const message = reason(error);
      const failure = { ticker: candidate.ticker, reason: message };
      if (candidate.isProtected) protectedMustRepair.push(failure);
      else replaceable.push(failure);
      if (providerLimitReached(message)) {
        stoppedReason = `Market-data provider limit reached while processing ${candidate.ticker}: ${message}`;
        break;
      }
    }
  }

  if (!stoppedReason && ratedTickers.length < targetCount) {
    stoppedReason = `Candidate reserve exhausted before ${targetCount} verified ratings were produced.`;
  }
  const accounting: RatingBatchAccounting = Object.freeze({
    targetCount,
    candidateLimit,
    totalCandidatesExamined: examinedCount,
    ratedCount: ratedTickers.length,
    protectedMustRepairCount: protectedMustRepair.length,
    replaceableCount: replaceable.length,
    replacementsAttempted: replaceable.length,
    finalUsableUniverse: ratedTickers.length,
    protectedMustRepair: Object.freeze(protectedMustRepair),
    replaceable: Object.freeze(replaceable),
    ratedTickers: Object.freeze(ratedTickers),
    stoppedReason,
    completedAt: new Date().toISOString(),
  });
  await batchStore.finishRun(runId, accounting);
  return accounting;
}
