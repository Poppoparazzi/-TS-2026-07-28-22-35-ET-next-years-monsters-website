// TS: 2026-08-20 00:58 ET

import type { AppConfig } from "../config.js";
import {
  runSecUniverseBatch,
  type SecBatchRunSummary,
} from "../universe/sec-batch-processor.js";
import { createUniverseStore } from "../universe/store.js";
import type { UniverseStatusSummary } from "../universe/types.js";

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

export function shouldSkipSecBackfill(
  status: UniverseStatusSummary,
  usableTarget: number,
): boolean {
  const hasIncompleteProtectedPilot = status.companies.some(
    (company) => company.isPilot && company.secStage !== "complete",
  );

  return (
    status.secCompleteCount >= usableTarget &&
    status.failedCount === 0 &&
    !hasIncompleteProtectedPilot
  );
}

export async function runSecUniverseBatchOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SecBatchRunSummary> {
  // Keep the agreed reserve strategy alive even if Render's service environment
  // loses the Blueprint values. Local/test environments remain opt-in so development
  // never launches a large SEC batch unexpectedly.
  const productionCandidateFallback = config.nodeEnv === "production" ? 5_000 : 0;
  const batchSize = environmentInteger(
    environment,
    "AUTO_SEC_BATCH_SIZE",
    productionCandidateFallback,
    0,
    5_000,
  );

  if (batchSize === 0) {
    return skippedSummary(0, "Automatic SEC universe processing is disabled.");
  }

  const usableTarget = environmentInteger(
    environment,
    "SEC_USABLE_TARGET",
    2_200,
    1,
    5_000,
  );
  const importLimit = environmentInteger(
    environment,
    "AUTO_IMPORT_UNIVERSE_LIMIT",
    productionCandidateFallback,
    0,
    5_000,
  );

  // Prevent the exact fixed-universe trap that left the broad target permanently
  // below the desired usable-stock count. When automatic import is enabled, it
  // must be able to load at least as many candidates as the usable target requires.
  if (importLimit > 0 && importLimit < usableTarget) {
    throw new Error(
      `AUTO_IMPORT_UNIVERSE_LIMIT=${importLimit} cannot satisfy SEC_USABLE_TARGET=${usableTarget}. ` +
      "Raise the candidate pool instead of retrying the same unresolved stocks.",
    );
  }

  // Once the broad usable target is satisfied, ordinary unresolved names no
  // longer hold the universe open. However, any rows still marked failed must
  // get one more queue pass so cleanup rules can convert known duplicate-CIK or
  // exhausted failures into nonblocking unresolved exceptions. Protected pilot
  // stocks also keep the worker open until their SEC stage is actually complete.
  const universeStore = createUniverseStore(config);
  try {
    if (universeStore.configured) {
      const status = await universeStore.getStatus(5_000);

      if (shouldSkipSecBackfill(status, usableTarget)) {
        return skippedSummary(
          batchSize,
          `SEC usable target already satisfied: ${status.secCompleteCount} complete >= ${usableTarget}, with no remaining failed SEC records and all protected pilot stocks complete. Unresolved names are nonblocking exceptions.`,
        );
      }
    }
  } finally {
    await universeStore.close();
  }

  return runSecUniverseBatch(config, {
    batchSize,
    // Match the production reserve-backfill policy even if an environment variable
    // is lost during manual recovery. The SEC provider still enforces its own request
    // gate, so eight workers improve pipeline utilization without bypassing throttling.
    concurrency: environmentInteger(
      environment,
      "SEC_BATCH_CONCURRENCY",
      8,
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
