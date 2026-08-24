// TS: 2026-08-23 21:04 ET

import type { AppConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { isServerlessRuntime } from "../deployment-policy.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createRatingBatchStore } from "../ratings/batch-store.js";
import { createSecDataProvider } from "../sec/index.js";
import { createUniverseStore } from "../universe/store.js";
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
  const universeStore = createUniverseStore(config);

  try {
    // The first public milestone is 500 ratings, but the recovery path must be
    // able to continue through the full 5,000-company reserve without silently
    // reintroducing a smaller startup-only ceiling.
    const desiredTargetCount = boundedInteger(environment.RATING_TARGET_COUNT, 500, 5_000);

    if (!ratingRefreshEnabled(environment, config.nodeEnv)) {
      return Object.freeze({
        status: "disabled",
        targetCount: desiredTargetCount,
        detail: "Automatic Monster Rating refresh is disabled.",
      });
    }
    if (
      !marketProvider.configured || !marketProvider.getDailyHistory ||
      !secProvider.configured || !persistenceStore.configured || !batchStore.configured ||
      !universeStore.configured
    ) {
      return Object.freeze({
        status: "dependencies-unconfigured",
        targetCount: desiredTargetCount,
        marketProvider: marketProvider.name,
        detail: "Not Yet Rated — Stay Tuned. Coming Soon. The licensed historical market feed is not configured.",
      });
    }

    // Universe status now counts only ratings completed by the current engine
    // version. Use that authoritative count directly instead of issuing a second
    // 5,000-company candidate scan merely to infer how many ratings already exist.
    // runRatingBatch will fetch the candidate reserve once if more ratings are needed.
    const universeStatus = await universeStore.getStatus(5_000);
    const alreadyRatedCount = universeStatus.ratingCompleteCount;
    const remainingTargetCount = Math.max(desiredTargetCount - alreadyRatedCount, 0);

    if (remainingTargetCount === 0) {
      return Object.freeze({
        status: "completed",
        targetCount: desiredTargetCount,
        alreadyRatedCount,
        remainingTargetCount,
        detail: `Monster Rating target already satisfied at ${alreadyRatedCount}/${desiredTargetCount} current-version ratings.`,
      });
    }

    const isTwelveData = marketProvider.name === "twelve-data";
    // Twelve Data Basic allows 8 API credits per minute. The batch job loads SPY
    // once and then spends one history credit per candidate. A 9-second start
    // interval preserves headroom below the provider ceiling in both explicit
    // Render configuration and fallback recovery behavior.
    const defaultMarketDelayMs = isTwelveData ? 9_000 : 0;
    const defaultLimitRetryMs = isTwelveData ? 65_000 : 0;
    // Do not let an exhausted daily quota strand a Render worker for many hours.
    // A handful of minute-boundary retries is enough for transient throttling.
    const defaultLimitMaxRetries = isTwelveData ? 8 : 0;
    const accounting = await runRatingBatch(
      { marketProvider, secProvider, persistenceStore, batchStore },
      {
        targetCount: remainingTargetCount,
        // Use the full evidence-ready reserve so ordinary ineligible names are
        // replacements, not blockers. The batch still stops as soon as the target is met.
        candidateLimit: boundedInteger(environment.RATING_CANDIDATE_LIMIT, 5_000, 5_000),
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
      desiredTargetCount,
      alreadyRatedCount,
      remainingTargetCount,
      ...accounting,
    });
  } finally {
    await Promise.all([persistenceStore.close(), batchStore.close(), universeStore.close()]);
  }
}
