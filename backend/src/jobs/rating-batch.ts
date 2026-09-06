// TS: 2026-09-06 09:57 ET

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
import type { RatingBatchAccounting, RatingBatchFailure, RatingBatchStore } from "../ratings/batch-store.js";
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

function reason(error: unknown): string { return error instanceof Error ? error.message : String(error); }
function providerLimitReached(message: string): boolean { return /rate limit|api credits|credit limit|too many requests|quota/i.test(message); }
function providerAuthorizationUnavailable(message: string): boolean { return /http 40[13]|unauthori[sz]ed|forbidden|invalid api key|api key.*invalid|authentication|entitlement|permission denied/i.test(message); }
function providerTransportUnavailable(message: string): boolean { return /fetch failed|network|timeout|timed out|econnreset|econnrefused|etimedout|enotfound|eai_again|dns|socket hang up|service unavailable|bad gateway|gateway timeout|http 408|http 5\d\d/i.test(message); }
function boundedDelay(value: number | undefined, maximum = 60_000): number { const parsed = Math.trunc(value ?? 0); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), maximum) : 0; }
// The Postgres market-history claim lease is capped at one hour. Three retries at the maximum
// 15-minute quota backoff keep deliberate retry sleep inside that lease instead of reopening the
// cross-worker duplicate-paid-call race while a worker is still waiting on the provider.
function boundedRetryCount(value: number | undefined): number { const parsed = Math.trunc(value ?? 0); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 3) : 0; }
function sleep(milliseconds: number): Promise<void> { return milliseconds <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, milliseconds)); }

class MarketHistoryRetryAbortedError extends Error {
  public constructor() {
    super("Market-history retry aborted because the paid-request claim could not be safely renewed.");
    this.name = "MarketHistoryRetryAbortedError";
  }
}

function countFailureDimension(
  failures: readonly RatingBatchFailure[],
  key: "reasonCode" | "suppressionStage",
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const failure of failures) {
    const value = failure[key];
    if (!value) continue;
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.freeze(counts);
}

function reusableHistorySuppressionReason(suppressionReason: string, usableBarCount: number): string {
  if (suppressionReason === "insufficient_liquidity") {
    return "Persisted provider-backed market history previously proved average daily dollar volume below the $1 million tradability floor.";
  }
  if (suppressionReason === "stale_market_data") {
    return "Persisted provider-backed market history is stale and cannot be reused for a current rating.";
  }
  if (suppressionReason === "insufficient_market_history") {
    return `Persisted market history has only ${usableBarCount} usable daily bars; at least 253 are required.`;
  }
  return `Persisted market-history evidence is suppressed by machine reason ${suppressionReason}.`;
}

function validateBenchmarkHistory(history: DailyMarketHistory, calculatedAt = new Date().toISOString()): string | null {
  const usableBars = history.bars
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0 && Number.isFinite(bar.volume) && bar.volume >= 0)
    .sort((left, right) => left.date.localeCompare(right.date));
  if (usableBars.length < 253) return `Benchmark market history has only ${usableBars.length} usable daily bars; at least 253 are required.`;
  const latestDate = usableBars.at(-1)?.date ?? "";
  const latestTime = Date.parse(latestDate);
  const calculatedTime = Date.parse(calculatedAt);
  if (!latestDate || !Number.isFinite(latestTime) || !Number.isFinite(calculatedTime)) return "Benchmark market history does not contain a valid latest daily-bar date.";
  if ((calculatedTime - latestTime) / (24 * 60 * 60 * 1_000) > 7) return `Benchmark market history is stale; latest daily bar is ${latestDate}.`;
  return null;
}

export async function runRatingBatch(
  dependencies: RatingBatchDependencies,
  options: RatingBatchOptions = {},
): Promise<RatingBatchAccounting> {
  const targetCount = Math.min(Math.max(Math.trunc(options.targetCount ?? 5_000), 1), 5_000);
  const candidateLimit = Math.min(Math.max(Math.trunc(options.candidateLimit ?? Math.max(targetCount * 2, 1_000)), targetCount), 5_000);
  const marketRequestDelayMs = boundedDelay(options.marketRequestDelayMs);
  const marketLimitRetryMs = boundedDelay(options.marketLimitRetryMs, 15 * 60_000);
  const marketLimitMaxRetries = boundedRetryCount(options.marketLimitMaxRetries);
  const { marketProvider, secProvider, persistenceStore, batchStore } = dependencies;
  if (!marketProvider.configured || !marketProvider.getDailyHistory) throw new Error("The licensed historical market-data provider is not configured.");
  if (!secProvider.configured || !persistenceStore.configured || !batchStore.configured) throw new Error("The SEC provider and production database are required for rating batches.");

  let lastMarketRequestStartedAt = 0;
  let beforeMarketHistoryRetryAttempt: (() => Promise<boolean>) | undefined;
  const getPacedHistory = async (symbol: string, outputSize: number): Promise<DailyMarketHistory> => {
    let providerLimitRetries = 0;
    while (true) {
      const elapsed = Date.now() - lastMarketRequestStartedAt;
      const waitMs = lastMarketRequestStartedAt === 0 ? 0 : Math.max(0, marketRequestDelayMs - elapsed);
      if (waitMs > 0) await sleep(waitMs);
      if (providerLimitRetries > 0 && beforeMarketHistoryRetryAttempt && !(await beforeMarketHistoryRetryAttempt())) {
        throw new MarketHistoryRetryAbortedError();
      }
      lastMarketRequestStartedAt = Date.now();
      try { return await marketProvider.getDailyHistory!(symbol, outputSize); }
      catch (error) {
        const message = reason(error);
        if (!providerLimitReached(message) || providerLimitRetries >= marketLimitMaxRetries) throw error;
        providerLimitRetries += 1;
        await sleep(marketLimitRetryMs);
      }
    }
  };

  const candidates = await batchStore.listCandidates(candidateLimit);
  const runId = await batchStore.startRun(targetCount, marketProvider.name);
  const ratedTickers: string[] = [];
  const protectedMustRepair: RatingBatchFailure[] = [];
  const replaceable: RatingBatchFailure[] = [];
  const recordFailure = async (failure: RatingBatchFailure, protectedCandidate: boolean): Promise<void> => {
    if (batchStore.recordCandidateFailure) {
      await batchStore.recordCandidateFailure(runId, failure, protectedCandidate);
    }
    if (protectedCandidate) protectedMustRepair.push(failure); else replaceable.push(failure);
  };
  const recordReusableHistorySuppression = async (
    ticker: string,
    isProtected: boolean,
  ): Promise<boolean> => {
    const suppression = await batchStore.getReusableMarketHistorySuppression(ticker, marketProvider.name);
    if (!suppression) return false;
    const failure = {
      ticker,
      reason: reusableHistorySuppressionReason(suppression.suppressionReason, suppression.usableBarCount),
      reasonCode: suppression.suppressionReason,
      suppressionStage: "stored_market_history_preflight",
    };
    await recordFailure(failure, isProtected);
    return true;
  };
  let examinedCount = 0;
  let stoppedReason: string | null = null;
  let benchmarkHistory: DailyMarketHistory | undefined;

  for (const candidate of candidates) {
    if (ratedTickers.length >= targetCount) break;
    examinedCount += 1;
    try {
      const [company, facts, filings] = await Promise.all([
        secProvider.getCompany(candidate.ticker),
        secProvider.getCompanyFacts(candidate.ticker),
        secProvider.getRecentFilings(candidate.ticker, 1),
      ]);
      await persistenceStore.saveSecCompany(company);
      await persistenceStore.saveSecFilings(company, filings);
      await persistenceStore.saveSecFacts(facts);

      if (company.cik <= 0 || facts.cik !== company.cik) {
        const failure = { ticker: candidate.ticker, reason: "Official SEC company identity does not match the company-facts identity.", reasonCode: "unresolved_sec_identity", suppressionStage: "sec_preflight" };
        await recordFailure(failure, candidate.isProtected);
        continue;
      }

      const annualFinancials = buildAnnualFinancialPeriods(facts);
      const annualRevenuePeriods = annualFinancials.filter((period) => typeof period.revenue === "number" && Number.isFinite(period.revenue));
      if (annualFinancials.length < 2 || annualRevenuePeriods.length < 2) {
        const failure = { ticker: candidate.ticker, reason: "At least two comparable annual SEC revenue periods are required.", reasonCode: "insufficient_financial_history", suppressionStage: "sec_preflight" };
        await recordFailure(failure, candidate.isProtected);
        continue;
      }

      if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;

      if (!benchmarkHistory) {
        try { benchmarkHistory = await getPacedHistory("SPY", 300); }
        catch (error) { stoppedReason = `Benchmark market history could not be loaded: ${reason(error)}`; break; }
        const benchmarkProblem = validateBenchmarkHistory(benchmarkHistory);
        if (benchmarkProblem) { stoppedReason = benchmarkProblem; break; }
      }

      // Recheck immediately before attempting the cross-worker claim. A concurrent worker may
      // have persisted durable ineligibility while this worker was loading SPY or pacing.
      if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;

      const marketHistoryClaimed = await batchStore.tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId);
      if (!marketHistoryClaimed) continue;

      try {
        // Recheck after the atomic claim as well. This closes the race between the last free
        // suppression read and claim acquisition without spending another paid provider call.
        if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;

        let history: DailyMarketHistory;
        try {
          // Migration 1013 makes a same-owner tryClaim call renew the bounded lease. The guard is
          // consulted only after a quota backoff and all pacing sleep, immediately before another
          // paid provider attempt. It also rechecks durable suppression while the worker slept.
          beforeMarketHistoryRetryAttempt = async () => {
            const renewed = await batchStore.tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId);
            if (!renewed) return false;
            return !(await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected));
          };
          history = await getPacedHistory(candidate.ticker, 300);
        }
        catch (error) {
          if (error instanceof MarketHistoryRetryAbortedError) continue;
          const message = reason(error);
          if (providerLimitReached(message) || providerAuthorizationUnavailable(message) || providerTransportUnavailable(message)) {
            stoppedReason = `Market-data provider unavailable while processing ${candidate.ticker}: ${message}`;
            break;
          }
          throw error;
        } finally {
          beforeMarketHistoryRetryAttempt = undefined;
        }

        const marketHistoryEvidence = buildMarketHistoryEvidence(history);
        await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);
        const calculatedAt = new Date().toISOString();
        const rating = calculateMonsterRatingV1(buildProductionRatingInput({ company, facts, companyHistory: history, benchmarkHistory, calculatedAt }));
        const quote = quoteFromDailyHistory(company, history);
        await persistenceStore.saveQuote(quote);

        if (!rating.eligible) {
          const failure = { ticker: candidate.ticker, reason: rating.reasons[0]?.message ?? rating.summary, reasonCode: rating.eligibilityCode, suppressionStage: "rating_engine" };
          await recordFailure(failure, candidate.isProtected);
          continue;
        }

        const publishableRating = buildPublishableRating({ rating, facts, filings, quote, secProviderName: secProvider.name });
        if (!persistenceStore.saveRating) throw new Error("Rating persistence is unavailable.");
        await persistenceStore.saveRating(publishableRating);
        ratedTickers.push(candidate.ticker);
      } finally {
        // A bounded lease guarantees recovery if release itself cannot reach Postgres. Do not turn
        // an already-persisted rating/evidence result into a false candidate failure on cleanup.
        await batchStore.releaseMarketHistoryRequestClaim(candidate.ticker, marketProvider.name, runId).catch(() => false);
      }
    } catch (error) {
      const message = reason(error);
      if (providerLimitReached(message) || providerAuthorizationUnavailable(message)) { stoppedReason = `Market-data provider remained unavailable while processing ${candidate.ticker}: ${message}`; break; }
      if (providerTransportUnavailable(message)) { stoppedReason = `Upstream transport unavailable while processing ${candidate.ticker}: ${message}`; break; }
      const failure = { ticker: candidate.ticker, reason: message, reasonCode: "candidate_processing_error", suppressionStage: "candidate_processing" };
      await recordFailure(failure, candidate.isProtected);
    }
  }

  if (!stoppedReason && ratedTickers.length < targetCount) stoppedReason = `Candidate reserve exhausted before ${targetCount} verified ratings were produced.`;
  const allFailures = Object.freeze([...protectedMustRepair, ...replaceable]);
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
    suppressionReasonCounts: countFailureDimension(allFailures, "reasonCode"),
    suppressionStageCounts: countFailureDimension(allFailures, "suppressionStage"),
    ratedTickers: Object.freeze(ratedTickers),
    stoppedReason,
    completedAt: new Date().toISOString(),
  });
  await batchStore.finishRun(runId, accounting);
  return accounting;
}
