// TS: 2026-08-11 12:10 UTC

import type { AppConfig } from "../config.js";
import {
  createPersistenceStore,
  type PersistenceStore,
} from "../database/persistence.js";
import {
  refreshPilotSymbol,
  type PilotRefreshDependencies,
  type PilotRefreshResult,
} from "../jobs/pilot-refresh.js";
import { createMarketDataProvider } from "../providers/index.js";
import type { MarketDataProvider } from "../providers/types.js";
import { createSecDataProvider } from "../sec/index.js";
import type { SecDataProvider } from "../sec/types.js";
import { createSecBatchQueue, type SecBatchQueue } from "./sec-batch-queue.js";

export interface SecBatchRunOptions {
  readonly batchSize: number;
  readonly concurrency: number;
  readonly maxAgeHours: number;
}

export interface SecBatchFailure {
  readonly ticker: string;
  readonly attemptCount: number;
  readonly message: string;
}

export interface SecBatchRunSummary {
  readonly status: "completed" | "skipped";
  readonly requestedBatchSize: number;
  readonly claimedCount: number;
  readonly succeededCount: number;
  readonly unresolvedCount: number;
  readonly failedCount: number;
  readonly concurrency: number;
  readonly maxAgeHours: number;
  readonly unresolvedTickers: readonly string[];
  readonly failures: readonly SecBatchFailure[];
  readonly reason: string | null;
  readonly completedAt: string;
}

export interface SecBatchProcessorDependencies {
  readonly queue?: SecBatchQueue;
  readonly persistenceStore?: PersistenceStore;
  readonly secProvider?: SecDataProvider;
  readonly marketProvider?: MarketDataProvider;
  readonly refreshSymbol?: (
    symbol: string,
    dependencies: PilotRefreshDependencies,
  ) => Promise<PilotRefreshResult>;
}

function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Math.trunc(value), minimum), maximum);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown SEC batch processing failure.";
}

function isPermanentSecNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    error.statusCode === 404
  );
}

function isDuplicateSecIdentity(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint" in error &&
    error.constraint === "companies_sec_cik_unique"
  );
}

export async function runSecUniverseBatch(
  config: AppConfig,
  options: SecBatchRunOptions,
  dependencies: SecBatchProcessorDependencies = {},
): Promise<SecBatchRunSummary> {
  const batchSize = boundedInteger(options.batchSize, 1, 2_500);
  const concurrency = boundedInteger(options.concurrency, 1, 8);
  const maxAgeHours = boundedInteger(options.maxAgeHours, 1, 24 * 30);
  const queue = dependencies.queue ?? createSecBatchQueue(config);
  const persistenceStore =
    dependencies.persistenceStore ?? createPersistenceStore(config);
  const secProvider = dependencies.secProvider ?? createSecDataProvider(config);
  const marketProvider =
    dependencies.marketProvider ?? createMarketDataProvider(config);
  const refreshSymbol = dependencies.refreshSymbol ?? refreshPilotSymbol;

  try {
    if (!queue.configured || !persistenceStore.configured || !secProvider.configured) {
      return Object.freeze({
        status: "skipped",
        requestedBatchSize: batchSize,
        claimedCount: 0,
        succeededCount: 0,
        unresolvedCount: 0,
        failedCount: 0,
        concurrency,
        maxAgeHours,
        unresolvedTickers: Object.freeze([]),
        failures: Object.freeze([]),
        reason: "DATABASE_URL and SEC_USER_AGENT are required for bulk SEC processing.",
        completedAt: new Date().toISOString(),
      });
    }

    const failures: SecBatchFailure[] = [];
    const unresolvedTickers: string[] = [];
    let claimedCount = 0;
    let succeededCount = 0;
    let unresolvedCount = 0;
    let failedCount = 0;

    while (claimedCount < batchSize) {
      const remainingCount = batchSize - claimedCount;
      const claimSize = Math.min(concurrency, remainingCount);
      const candidates = [...(await queue.claim(claimSize, maxAgeHours))];

      if (candidates.length === 0) break;
      claimedCount += candidates.length;

      await Promise.all(
        candidates.map(async (candidate) => {
          try {
            await refreshSymbol(candidate.ticker, {
              marketProvider,
              secProvider,
              persistenceStore,
            });
            await queue.markComplete(candidate.ticker);
            succeededCount += 1;
          } catch (error) {
            const message = safeMessage(error);

            if (isPermanentSecNotFound(error) || isDuplicateSecIdentity(error)) {
              unresolvedCount += 1;
              unresolvedTickers.push(candidate.ticker);
              await queue.markUnresolved(candidate.ticker, message);
              return;
            }

            failedCount += 1;
            failures.push(
              Object.freeze({
                ticker: candidate.ticker,
                attemptCount: candidate.attemptCount,
                message,
              }),
            );
            await queue.markFailed(candidate.ticker, message);
          }
        }),
      );
    }

    return Object.freeze({
      status: "completed",
      requestedBatchSize: batchSize,
      claimedCount,
      succeededCount,
      unresolvedCount,
      failedCount,
      concurrency,
      maxAgeHours,
      unresolvedTickers: Object.freeze(unresolvedTickers),
      failures: Object.freeze(failures),
      reason: null,
      completedAt: new Date().toISOString(),
    });
  } finally {
    await Promise.all([queue.close(), persistenceStore.close()]);
  }
}
