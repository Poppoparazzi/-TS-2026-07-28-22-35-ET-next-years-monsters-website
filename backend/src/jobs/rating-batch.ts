// TS: 2026-09-05 14:00 ET

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
function boundedRetryCount(value: number | undefined): number { const parsed = Math.trunc(value ?? 0); return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1_000) : 0; }
function sleep(milliseconds: number): Promise<void> { return milliseconds <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, milliseconds)); }

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
  const getPacedHistory = async (symbol: string, outputSize: number): Promise<DailyMarketHistory> => {
    let providerLimitRetries = 0;
    while (true) {
      const elapsed = Date.now() - lastMarketRequestStartedAt;
      const waitMs = lastMarketRequestStartedAt === 0 ? 0 : Math.max(0, marketRequestDelayMs - elapsed);
      if (waitMs > 0) await sleep(waitMs);
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
    const isLiquiditySuppression = suppression.suppressionReason === "insufficient_liquidity";
    const failure = {
      ticker,
      reason: isLiquiditySuppression
        ? "Persisted provider-backed market history previously proved average daily dollar volume below the $1 million tradability floor."
        : `Persisted market history has only ${suppression.usableBarCount} usable daily bars; at least 253 are required.`,
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

      // Recheck immediately before the paid company-history request. A concurrent worker may
      // have persisted a durable ineligibility result while this worker was loading SPY or pacing.
      if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;

      let history: DailyMarketHistory;
      try { history = await getPacedHistory(candidate.ticker, 300); }
      catch (error) {
        const message = reason(error);
        if (providerLimitReached(message) || providerAuthorizationUnavailable(message) || providerTransportUnavailable(message)) {
          stoppedReason = `Market-data provider unavailable while processing ${candidate.ticker}: ${message}`;
          break;
        }
        throw error;
      }

      const marketHistoryEvidence = buildMarketHistoryEvidence(history);
      await batchStore.saveMarketHistoryEvidence(marketHistoryEvidence);
      const calculatedAt = new Date().toISOString();
      const rating = calculateMonsterRatingV1(buildProductionRatingInput({ company, facts, companyHistory: history, benchmarkHistory, calculatedAt }));
      const quote = quoteFromDailyHistory(company, history);
      await persistenceStore.saveQuote(quote);

      if (!rating.eligible) {
        if (rating.eligibilityCode === "insufficient_liquidity") {
          await batchStore.saveMarketHistoryEvidence(Object.freeze({
            ...marketHistoryEvidence,
            suppressionReason: "insufficient_liquidity" as const,
          }));
        }
        const failure = { ticker: candidate.ticker, reason: rating.reasons[0]?.message ?? rating.summary, reasonCode: rating.eligibilityCode, suppressionStage: "rating_engine" };
        await recordFailure(failure, candidate.isProtected);
        continue;
      }

      const publishableRating = buildPublishableRating({ rating, facts, filings, quote, secProviderName: secProvider.name });
      if (!persistenceStore.saveRating) throw new Error("Rating persistence is unavailable.");
      await persistenceStore.saveRating(publishableRating);
      ratedTickers.push(candidate.ticker);
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