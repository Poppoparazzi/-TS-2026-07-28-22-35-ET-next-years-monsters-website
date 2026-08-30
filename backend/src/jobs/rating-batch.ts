// TS: 2026-08-30 11:57 ET

import type { PersistenceStore } from "../database/persistence.js";
import type { DailyMarketHistory, MarketDataProvider } from "../providers/types.js";
import { calculateMonsterRatingV1 } from "../ratings/engine-v1.js";
import {
  buildAnnualFinancialPeriods,
  buildProductionRatingInput,
  buildPublishableRating,
  quoteFromDailyHistory,
} from "../ratings/input-builder.js";
import { buildMarketHistoryEvidence } from "../ratings/market-history-evidence.js";
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

function providerAuthorizationUnavailable(message: string): boolean {
  return /http 40[13]|unauthori[sz]ed|forbidden|invalid api key|api key.*invalid|authentication|entitlement|permission denied/i.test(message);
}

function providerTransportUnavailable(message: string): boolean {
  return /fetch failed|network|timeout|timed out|econnreset|econnrefused|etimedout|enotfound|eai_again|dns|socket hang up|service unavailable|bad gateway|gateway timeout|http 408|http 5\d\d/i.test(message);
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

function validateBenchmarkHistory(history: DailyMarketHistory, calculatedAt = new Date().toISOString()): string | null {
  const usableBars = history.bars
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(bar.volume) && bar.volume >= 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (usableBars.length < 253) {
    return `Benchmark market history has only ${usableBars.length} usable daily bars; at least 253 are required.`;
  }

  const latestDate = usableBars.at(-1)?.date ?? "";
  const latestTime = Date.parse(latestDate);
  const calculatedTime = Date.parse(calculatedAt);
  if (!latestDate || !Number.isFinite(latestTime) || !Number.isFinite(calculatedTime)) {
    return "Benchmark market history does not contain a valid latest daily-bar date.";
  }

  const ageDays = (calculatedTime - latestTime) / (24 * 60 * 60 * 1_000);
  if (ageDays > 7) {
    return `Benchmark market history is stale; latest daily bar is ${latestDate}.`;
  }
  return null;
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
  const protectedMustRepair: { ticker: string; reason: string; reasonCode?: string; suppressionStage?: string }[] = [];
  const replaceable: { ticker: string; reason: string; reasonCode?: string; suppressionStage?: string }[] = [];
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
          reasonCode: "unresolved_sec_identity",
          suppressionStage: "sec_preflight",
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
          reasonCode: "insufficient_financial_history",
          suppressionStage: "sec_preflight",
        };
        if (candidate.isProtected) protectedMustRepair.push(failure);
        else replaceable.push(failure);
        continue;
      }

      // A recent paid history response that already proved this ticker cannot meet
      // the 253-bar gate is reusable production evidence. Consult that durable
      // machine-readable suppression before buying SPY or company history again.
      // The database helper expires the suppression after 24 hours, so young stocks
      // are reconsidered rather than suppressed forever.
      const persistedHistorySuppression = await batchStore.getReusableMarketHistorySuppression(
        candidate.ticker,
        marketProvider.name,
      );
      if (persistedHistorySuppression) {
        const failure = {
          ticker: candidate.ticker,
          reason: `Persisted market history has only ${persistedHistorySuppression.usableBarCount} usable daily bars; at least 253 are required.`,
          reasonCode: persistedHistorySuppression.suppressionReason ?? "insufficient_market_history",
          suppressionStage: "stored_market_history_preflight",
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

        // Every publishable rating needs a current 253-session benchmark. If the
        // shared SPY response itself cannot satisfy that gate, no candidate in this
        // run can succeed. Stop before buying company histories one by one.
        const benchmarkProblem = validateBenchmarkHistory(benchmarkHistory);
        if (benchmarkProblem) {
          stoppedReason = benchmarkProblem;
          break;
        }
      }

      let history: DailyMarketHistory;
      try {
        history = await getPacedHistory(candidate.ticker, 300);
      } catch (error) {
        const message = reason(error);
        // Provider-wide quota, authorization, entitlement, DNS, or transport trouble says
        // nothing about the stock. Stop the batch without poisoning the repair or
        // replacement roster. Genuine symbol/evidence errors continue normally.
        if (
          providerLimitReached(message) ||
          providerAuthorizationUnavailable(message) ||
          providerTransportUnavailable(message)
        ) {
          stoppedReason = `Market-data provider unavailable while processing ${candidate.ticker}: ${message}`;
          break;
        }
        throw error;
      }

      // Preserve the exact provider-backed daily-history evidence immediately after
      // a successful paid fetch, even when the rating engine later withholds a score.
      // This is the durable input for the future 253-real-bar preflight.
      await batchStore.saveMarketHistoryEvidence(buildMarketHistoryEvidence(history));

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
        const failure = {
          ticker: candidate.ticker,
          reason: rating.reasons[0]?.message ?? rating.summary,
          reasonCode: rating.eligibilityCode,
          suppressionStage: "rating_engine",
        };
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
      // Provider quota/rate-limit or authorization/entitlement exhaustion is a
      // batch-level condition, not evidence that the current company is bad.
      if (providerLimitReached(message) || providerAuthorizationUnavailable(message)) {
        stoppedReason = `Market-data provider remained unavailable while processing ${candidate.ticker}: ${message}`;
        break;
      }

      // The same rule applies to SEC, database, DNS, and other upstream transport
      // failures caught by the outer guard. A timeout is infrastructure evidence,
      // not evidence that the current ticker should be repaired or replaced.
      if (providerTransportUnavailable(message)) {
        stoppedReason = `Upstream transport unavailable while processing ${candidate.ticker}: ${message}`;
        break;
      }

      const failure = {
        ticker: candidate.ticker,
        reason: message,
        reasonCode: "candidate_processing_error",
        suppressionStage: "candidate_processing",
      };
      if (candidate.isProtected) protectedMustRepair.push(failure);
      else replaceable.push(failure);
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
