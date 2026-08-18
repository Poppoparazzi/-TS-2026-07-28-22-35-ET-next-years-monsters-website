// TS: 2026-08-18 15:36 ET

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

  // The reserve milestone is numeric: once 2,000 SEC-complete companies exist,
  // the broad backfill is done. Failed or incomplete names no longer hold the
  // universe open. Important/pilot stocks can remain on their separate repair
  // path without blocking completion of the usable-stock target.
  const universeStore = createUniverseStore(config);
  try {
    if (universeStore.configured) {
      const status = await universeStore.getStatus(5_000);

      if (status.secCompleteCount >= usableTarget) {
        return skippedSummary(
          batchSize,
          `SEC usable target already satisfied: ${status.secCompleteCount} complete >= ${usableTarget}. Remaining failures are exceptions, not blockers.`,
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
    // Keep the fallback aligned with production's reserve-first policy. If the
    // environment value is ever absent, do not recycle yesterday's successful SEC
    // records ahead of fresh replacement candidates.
    maxAgeHours: environmentInteger(
      environment,
      "SEC_BATCH_MAX_AGE_HOURS",
      720,
      1,
      720,
    ),
  });
}
