// TS: 2026-08-02 15:10 ET

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
  readonly failedCount: number;
  readonly concurrency: number;
  readonly maxAgeHours: number;
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

export async function runSecUniverseBatch(
  config: AppConfig,
  options: SecBatchRunOptions,
  dependencies: SecBatchProcessorDependencies = {},
): Promise<SecBatchRunSummary> {
  const batchSize = boundedInteger(options.batchSize, 1, 500);
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
        failedCount: 0,
        concurrency,
        maxAgeHours,
        failures: Object.freeze([]),
        reason: "DATABASE_URL and SEC_USER_AGENT are required for bulk SEC processing.",
        completedAt: new Date().toISOString(),
      });
    }

    const candidates = [...(await queue.claim(batchSize, maxAgeHours))];
    const failures: SecBatchFailure[] = [];
    let succeededCount = 0;
    let failedCount = 0;
    let nextIndex = 0;

    const workerCount = Math.min(concurrency, Math.max(candidates.length, 1));
    const workers = Array.from({ length: workerCount }, async () => {
      while (nextIndex < candidates.length) {
        const candidateIndex = nextIndex;
        nextIndex += 1;
        const candidate = candidates[candidateIndex];
        if (!candidate) return;

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
      }
    });

    await Promise.all(workers);

    return Object.freeze({
      status: "completed",
      requestedBatchSize: batchSize,
      claimedCount: candidates.length,
      succeededCount,
      failedCount,
      concurrency,
      maxAgeHours,
      failures: Object.freeze(failures),
      reason: null,
      completedAt: new Date().toISOString(),
    });
  } finally {
    await Promise.all([queue.close(), persistenceStore.close()]);
  }
}
