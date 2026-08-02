// TS: 2026-08-02 17:16 ET

import type { AppConfig } from "../config.js";
import {
  runSecUniverseBatch,
  type SecBatchRunSummary,
} from "../universe/sec-batch-processor.js";

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

export async function runSecUniverseBatchOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SecBatchRunSummary> {
  const batchSize = environmentInteger(
    environment,
    "AUTO_SEC_BATCH_SIZE",
    0,
    0,
    500,
  );

  if (batchSize === 0) {
    return Object.freeze({
      status: "skipped",
      requestedBatchSize: 0,
      claimedCount: 0,
      succeededCount: 0,
      unresolvedCount: 0,
      failedCount: 0,
      concurrency: 0,
      maxAgeHours: 0,
      unresolvedTickers: Object.freeze([]),
      failures: Object.freeze([]),
      reason: "Automatic SEC universe processing is disabled.",
      completedAt: new Date().toISOString(),
    });
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
