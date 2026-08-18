// TS: 2026-08-18 06:01 ET

import type { AppConfig } from "../config.js";
import {
  runSecUniverseBatch,
  type SecBatchRunSummary,
} from "../universe/sec-batch-processor.js";
import { createUniverseStore } from "../universe/store.js";

function environmentInteger(
  environment: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = environment[key]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function skippedSummary(batchSize: number, reason: string): SecBatchRunSummary {
  return Object.freeze({
    status: "skipped",
    requestedBatchSize: batchSize,
    claimedCount: 0,
    succeededCount: 0,
    unresolvedCount: 0,
    failedCount: 0,
    concurrency: 0,
    maxAgeHours: 0,
    unresolvedTickers: Object.freeze([]),
    failures: Object.freeze([]),
    reason,
    completedAt: new Date().toISOString(),
  });
}

export async function runSecUniverseBatchOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SecBatchRunSummary> {
  const batchSize = environmentInteger(
    environment,
    "AUTO_SEC_BATCH_SIZE",
    0,
    0,
    5_000,
  );

  if (batchSize === 0) {
    return skippedSummary(0, "Automatic SEC universe processing is disabled.");
  }

  const usableTarget = environmentInteger(
    environment,
    "SEC_USABLE_TARGET",
    2_000,
    1,
    5_000,
  );

  // Once the active universe already contains the requested number of SEC-complete
  // companies, do not spend restart time and SEC fair-access capacity reprocessing
  // reserve names. The reserve pool stays loaded and available for future backfill.
  const universeStore = createUniverseStore(config);
  try {
    if (universeStore.configured) {
      const status = await universeStore.getStatus(5_000);
      if (status.secCompleteCount >= usableTarget) {
        return skippedSummary(
          batchSize,
          `SEC usable target already satisfied: ${status.secCompleteCount} complete >= ${usableTarget}.`,
        );
      }
    }
  } finally {
    await universeStore.close();
  }

  return runSecUniverseBatch(config, {
    batchSize,
    concurrency: environmentInteger(
      environment,
      "SEC_BATCH_CONCURRENCY",
      3,
      1,
      8,
    ),
    maxAgeHours: environmentInteger(
      environment,
      "SEC_BATCH_MAX_AGE_HOURS",
      24,
      1,
      720,
    ),
  });
}
