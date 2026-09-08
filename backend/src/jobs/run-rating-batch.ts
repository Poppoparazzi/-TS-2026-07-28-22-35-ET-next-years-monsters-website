// TS: 2026-09-08 12:23 ET

import { loadConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createRatingBatchStore } from "../ratings/batch-store.js";
import { createSecDataProvider } from "../sec/index.js";
import { runRatingBatch } from "./rating-batch.js";

function boundedNonNegativeInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), maximum) : fallback;
}

const config = loadConfig();
const persistenceStore = createPersistenceStore(config);
const batchStore = createRatingBatchStore(config);

try {
  const targetCount = Number(process.env.RATING_TARGET_COUNT ?? "500");
  const candidateLimit = Number(process.env.RATING_CANDIDATE_LIMIT ?? "1000");
  const isTwelveData = config.marketDataProvider === "twelve-data";
  const accounting = await runRatingBatch(
    {
      marketProvider: createMarketDataProvider(config),
      secProvider: createSecDataProvider(config),
      persistenceStore,
      batchStore,
    },
    {
      targetCount,
      candidateLimit,
      marketRequestDelayMs: boundedNonNegativeInteger(
        process.env.RATING_MARKET_REQUEST_DELAY_MS,
        isTwelveData ? 9_000 : 0,
        60_000,
      ),
      marketLimitRetryMs: boundedNonNegativeInteger(
        process.env.RATING_MARKET_LIMIT_RETRY_MS,
        isTwelveData ? 65_000 : 0,
        15 * 60_000,
      ),
      marketLimitMaxRetries: boundedNonNegativeInteger(
        process.env.RATING_MARKET_LIMIT_MAX_RETRIES,
        isTwelveData ? 3 : 0,
        3,
      ),
    },
  );
  process.stdout.write(`${JSON.stringify(accounting, null, 2)}\n`);
  if (accounting.ratedCount < accounting.targetCount) process.exitCode = 2;
} finally {
  await Promise.all([persistenceStore.close(), batchStore.close()]);
}
