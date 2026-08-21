// TS: 2026-08-21 15:16 UTC

import type { AppConfig } from "../config.js";
import { isProtectedStrategicTicker } from "../policy/protected-stocks.js";
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
    protectedMustRepairCount: 0,
    replaceableFailureCount: 0,
    replacementsAttemptedCount: 0,
    concurrency: 0,
    maxAgeHours: 0,
    unresolvedTickers: Object.freeze([]),
    failures: Object.freeze([]),
    reason,
    completedAt: new Date().toISOString(),
  });
}

export function secEvidenceReadyCount(status: UniverseStatusSummary): number {
  return status.companies.filter(
    (company) =>
      company.secStage === "complete" &&
      company.hasSecIdentity &&
      company.hasFilings &&
      company.hasFacts,
  ).length;
}

function isProtectedCompany(company: UniverseStatusSummary["companies"][number]): boolean {
  return company.isPilot || isProtectedStrategicTicker(company.ticker);
}

function isSecEvidenceReady(company: UniverseStatusSummary["companies"][number]): boolean {
  return (
    company.secStage === "complete" &&
    company.hasSecIdentity &&
    company.hasFilings &&
    company.hasFacts
  );
}

export function shouldSkipSecBackfill(
  status: UniverseStatusSummary,
  usableTarget: number,
): boolean {
  const hasIncompleteProtectedCompany = status.companies.some(
    (company) => isProtectedCompany(company) && !isSecEvidenceReady(company),
  ) || status.protectedMissingCount > 0;

  return (
    status.secEvidenceReadyCount >= usableTarget &&
    !hasIncompleteProtectedCompany
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

  if (importLimit > 0 && importLimit < usableTarget) {
    throw new Error(
      `AUTO_IMPORT_UNIVERSE_LIMIT=${importLimit} cannot satisfy SEC_USABLE_TARGET=${usableTarget}. ` +
      "Raise the candidate pool instead of retrying the same unresolved stocks.",
    );
  }

  // "Usable" now means a company has completed SEC processing plus an SEC identity,
  // at least one filing, and company facts. A green pipeline stage alone is not enough
  // to stop the reserve worker. Ordinary unresolved names remain nonblocking once the
  // evidence-ready target is satisfied. Ordinary exceptions are replaceable and do
  // not block completion; protected companies remain mandatory repair work.
  const universeStore = createUniverseStore(config);
  try {
    if (universeStore.configured) {
      const status = await universeStore.getStatus(5_000);
      const evidenceReadyCount = status.secEvidenceReadyCount;

      if (shouldSkipSecBackfill(status, usableTarget)) {
        return skippedSummary(
          batchSize,
          `SEC usable target already satisfied: ${evidenceReadyCount} evidence-ready >= ${usableTarget}, with all protected pilot/strategic stocks evidence-ready. Ordinary failed or unresolved names are nonblocking replaceable exceptions.`,
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
      8,
      1,
      8,
    ),
    maxAgeHours: environmentInteger(
      environment,
      "SEC_BATCH_MAX_AGE_HOURS",
      720,
      1,
      720,
    ),
  });
}
