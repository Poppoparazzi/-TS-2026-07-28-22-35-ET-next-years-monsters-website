// TS: 2026-08-23 19:02 ET

import type { PersistenceStore } from "../database/persistence.js";
import type { DailyMarketHistory, MarketDataProvider } from "../providers/types.js";
import { calculateMonsterRatingV1 } from "../ratings/engine-v1.js";
import {
  buildAnnualFinancialPeriods,
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
  readonly marketLimitRetryMs?: number;
  readonly marketLimitMaxRetries?: number;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function providerLimitReached(message: string): boolean {
  return /rate limit|api credits|credit limit|too many requests|quota/i.test(message);
}

function boundedDelay(value: number | undefined, maximum = 60_000): number {
  const parsed = Math.trunc(value ?? 0);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), maximum) : 0;
}

function boundedRetryCount(value: number | undefined): number {
  const parsed = Math.trunc(value ?? 0);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1_000) : 0;
}

function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function runRatingBatch(
  dependencies: RatingBatchDependencies,
  options: RatingBatchOptions = {},
): Promise<RatingBatchAccounting> {
  // The production reserve is 5,000 companies. Do not reintroduce a smaller
  // hidden bulk-rating ceiling after the first-500 milestone is crossed.
  const targetCount = Math.min(Math.max(Math.trunc(options.targetCount ?? 500), 1), 5_000);
  const candidateLimit = Math.min(
    Math.max(Math.trunc(options.candidateLimit ?? Math.max(targetCount * 2, 1_000)), targetCount),
    5_000,
  );
  const marketRequestDelayMs = boundedDelay(options.marketRequestDelayMs);
  const marketLimitRetryMs = boundedDelay(options.marketLimitRetryMs, 15 * 60_000);
  const marketLimitMaxRetries = boundedRetryCount(options.marketLimitMaxRetries);
  const { marketProvider, secProvider, persistenceStore, batchStore } = dependencies;
  if (!marketProvider.configured || !marketProvider.getDailyHistory) {
    throw new Error("The licensed historical market-data provider is not configured.");
  }
  if (!secProvider.configured || !persistenceStore.configured || !batchStore.configured) {
    throw new Error("The SEC provider and production database are required for rating batches.");
  }

  let lastMarketRequestStartedAt = 0;
  const getPacedHistory = async (symbol: string, outputSize: number): Promise<DailyMarketHistory> => {
    let providerLimitRetries = 0;

    while (true) {
      const elapsed = Date.now() - lastMarketRequestStartedAt;
      const waitMs = lastMarketRequestStartedAt === 0 ? 0 : Math.max(0, marketRequestDelayMs - elapsed);
      if (waitMs > 0) await sleep(waitMs);
      lastMarketRequestStartedAt = Date.now();

      try {
        return await marketProvider.getDailyHistory!(symbol, outputSize);
      } catch (error) {
        const message = reason(error);
        if (!providerLimitReached(message) || providerLimitRetries >= marketLimitMaxRetries) {
          throw error;
        }

        providerLimitRetries += 1;
        await sleep(marketLimitRetryMs);
      }
    }
  };

  const candidates = await batchStore.listCandidates(candidateLimit);
  const runId = await batchStore.startRun(targetCount, marketProvider.name);
  const ratedTickers: string[] = [];
  const protectedMustRepair: { ticker: string; reason: string }[] = [];
  const replaceable: { ticker: string; reason: string }[] = [];
  let examinedCount = 0;
  let stoppedReason: string | null = null;
  let benchmarkHistory: DailyMarketHistory | undefined;

  for (const candidate of candidates) {
    if (ratedTickers.length >= targetCount) break;
    examinedCount += 1;
    try {
      // Qualify and persist the SEC side first. A failed SEC lookup or database
      // write must not consume a licensed market-history request, and a later
      // market/provider failure must not discard SEC evidence we already earned.
      const [company, facts, filings] = await Promise.all([
        secProvider.getCompany(candidate.ticker),
        secProvider.getCompanyFacts(candidate.ticker),
        secProvider.getRecentFilings(candidate.ticker, 1),
      ]);
      await persistenceStore.saveSecCompany(company);
      await persistenceStore.saveSecFilings(company, filings);
      await persistenceStore.saveSecFacts(facts);

      // A mismatched SEC identity can never produce a publishable rating. Detect
      // it after preserving the real SEC response but before buying SPY or company
      // market history. Protected names stay in repair; ordinary names are replaceable.
      if (company.cik <= 0 || facts.cik !== company.cik) {
        const failure = {
          ticker: candidate.ticker,
          reason: "Official SEC company identity does not match the company-facts identity.",
        };
        if (candidate.isProtected) protectedMustRepair.push(failure);
        else replaceable.push(failure);
        continue;
      }

      // The rating engine cannot possibly publish a score without at least two
      // comparable annual SEC revenue periods. Detect that from free SEC evidence
      // before spending any licensed market-history request, including the shared
      // benchmark request for a batch that may contain no viable candidates.
      const annualFinancials = buildAnnualFinancialPeriods(facts);
      const annualRevenuePeriods = annualFinancials.filter(
        (period) => typeof period.revenue === "number" && Number.isFinite(period.revenue),
      );
      if (annualFinancials.length < 2 || annualRevenuePeriods.length < 2) {
        const failure = {
          ticker: candidate.ticker,
          reason: "At least two comparable annual SEC revenue periods are required.",
        };
        if (candidate.isProtected) protectedMustRepair.push(failure);
        else replaceable.push(failure);
        continue;
      }

      if (!benchmarkHistory) {
        try {
          benchmarkHistory = await getPacedHistory("SPY", 300);
        } catch (error) {
          stoppedReason = `Benchmark market history could not be loaded: ${reason(error)}`;
          break;
        }
      }

      const history = await getPacedHistory(candidate.ticker, 300);
      const calculatedAt = new Date().toISOString();
      const rating = calculateMonsterRatingV1(buildProductionRatingInput({
        company,
        facts,
        companyHistory: history,
        benchmarkHistory,
        calculatedAt,
      }));

      // Every successful market fetch is useful production evidence, even when
      // the rating engine correctly withholds a score. Persist the real quote so
      // future selection/preflight work does not throw away a paid provider call.
      const quote = quoteFromDailyHistory(company, history);
      await persistenceStore.saveQuote(quote);

      if (!rating.eligible) {
        const failure = { ticker: candidate.ticker, reason: rating.reasons[0]?.message ?? rating.summary };
        if (candidate.isProtected) protectedMustRepair.push(failure);
        else replaceable.push(failure);
        continue;
      }

      const publishableRating = buildPublishableRating({
        rating,
        facts,
        filings,
        quote,
        secProviderName: secProvider.name,
      });
      if (!persistenceStore.saveRating) throw new Error("Rating persistence is unavailable.");
      await persistenceStore.saveRating(publishableRating);
      ratedTickers.push(candidate.ticker);
    } catch (error) {
      const message = reason(error);
      const failure = { ticker: candidate.ticker, reason: message };
      if (candidate.isProtected) protectedMustRepair.push(failure);
      else replaceable.push(failure);
      if (providerLimitReached(message)) {
        stoppedReason = `Market-data provider limit remained unavailable after ${marketLimitMaxRetries} retries while processing ${candidate.ticker}: ${message}`;
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