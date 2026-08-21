// TS: 2026-08-21 17:39 UTC

import type { AppConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createRatingBatchStore } from "../ratings/batch-store.js";
import { createSecDataProvider } from "../sec/index.js";
import { runRatingBatch } from "./rating-batch.js";

function enabled(environment: NodeJS.ProcessEnv): boolean {
  return (environment.AUTO_REFRESH_RATINGS_ON_START ?? "").trim().toLowerCase() === "true";
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

export async function runRatingBatchOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  const marketProvider = createMarketDataProvider(config);
  const secProvider = createSecDataProvider(config);
  const persistenceStore = createPersistenceStore(config);
  const batchStore = createRatingBatchStore(config);

  try {
    if (!enabled(environment)) {
      return Object.freeze({
        status: "disabled",
        targetCount: boundedInteger(environment.RATING_TARGET_COUNT, 500, 1_000),
        detail: "Automatic Monster Rating refresh is disabled.",
      });
    }
    if (
      !marketProvider.configured || !marketProvider.getDailyHistory ||
      !secProvider.configured || !persistenceStore.configured || !batchStore.configured
    ) {
      return Object.freeze({
        status: "dependencies-unconfigured",
        targetCount: boundedInteger(environment.RATING_TARGET_COUNT, 500, 1_000),
        marketProvider: marketProvider.name,
        detail: "Not Yet Rated — Stay Tuned. Coming Soon. The licensed historical market feed is not configured.",
      });
    }

    const accounting = await runRatingBatch(
      { marketProvider, secProvider, persistenceStore, batchStore },
      {
        targetCount: boundedInteger(environment.RATING_TARGET_COUNT, 500, 1_000),
        candidateLimit: boundedInteger(environment.RATING_CANDIDATE_LIMIT, 1_000, 5_000),
      },
    );
    return Object.freeze({
      status: accounting.ratedCount >= accounting.targetCount ? "completed" : "partial",
      ...accounting,
    });
  } finally {
    await Promise.all([persistenceStore.close(), batchStore.close()]);
  }
}
