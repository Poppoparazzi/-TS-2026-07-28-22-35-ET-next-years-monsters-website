// TS: 2026-08-21 16:34 ET

import type { AppConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { isServerlessRuntime } from "../deployment-policy.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createRatingBatchStore } from "../ratings/batch-store.js";
import { createSecDataProvider } from "../sec/index.js";
import { runRatingBatch } from "./rating-batch.js";

export function ratingRefreshEnabled(
  environment: NodeJS.ProcessEnv,
  nodeEnv: string,
): boolean {
  const configured = (environment.AUTO_REFRESH_RATINGS_ON_START ?? "").trim().toLowerCase();
  if (configured) return configured === "true";

  // Persistent production should keep the audited rating recovery alive even if
  // the Render Blueprint value drifts or is temporarily absent. Serverless
  // collateral stays opt-in so it never launches a startup batch unexpectedly.
  return nodeEnv === "production" && !isServerlessRuntime(environment);
}

function boundedInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), maximum) : fallback;
}

function boundedNonNegativeInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), maximum) : fallback;
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
    if (!ratingRefreshEnabled(environment, config.nodeEnv)) {
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

    const isTwelveData = marketProvider.name === "twelve-data";
    const defaultMarketDelayMs = isTwelveData ? 9_000 : 0;
    const defaultLimitRetryMs = isTwelveData ? 65_000 : 0;
    const defaultLimitMaxRetries = isTwelveData ? 480 : 0;
    const accounting = await runRatingBatch(
      { marketProvider, secProvider, persistenceStore, batchStore },
      {
        targetCount: boundedInteger(environment.RATING_TARGET_COUNT, 500, 1_000),
        candidateLimit: boundedInteger(environment.RATING_CANDIDATE_LIMIT, 1_000, 5_000),
        marketRequestDelayMs: boundedNonNegativeInteger(
          environment.RATING_MARKET_REQUEST_DELAY_MS,
          defaultMarketDelayMs,
          60_000,
        ),
        marketLimitRetryMs: boundedNonNegativeInteger(
          environment.RATING_MARKET_LIMIT_RETRY_MS,
          defaultLimitRetryMs,
          15 * 60_000,
        ),
        marketLimitMaxRetries: boundedNonNegativeInteger(
          environment.RATING_MARKET_LIMIT_MAX_RETRIES,
          defaultLimitMaxRetries,
          1_000,
        ),
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
