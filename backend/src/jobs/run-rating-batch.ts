// TS: 2026-08-21 17:08 UTC

import { loadConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createRatingBatchStore } from "../ratings/batch-store.js";
import { createSecDataProvider } from "../sec/index.js";
import { runRatingBatch } from "./rating-batch.js";

const config = loadConfig();
const persistenceStore = createPersistenceStore(config);
const batchStore = createRatingBatchStore(config);

try {
  const targetCount = Number(process.env.RATING_TARGET_COUNT ?? "500");
  const candidateLimit = Number(process.env.RATING_CANDIDATE_LIMIT ?? "1000");
  const accounting = await runRatingBatch(
    {
      marketProvider: createMarketDataProvider(config),
      secProvider: createSecDataProvider(config),
      persistenceStore,
      batchStore,
    },
    { targetCount, candidateLimit },
  );
  process.stdout.write(`${JSON.stringify(accounting, null, 2)}\n`);
  if (accounting.ratedCount < accounting.targetCount) process.exitCode = 2;
} finally {
  await Promise.all([persistenceStore.close(), batchStore.close()]);
}
