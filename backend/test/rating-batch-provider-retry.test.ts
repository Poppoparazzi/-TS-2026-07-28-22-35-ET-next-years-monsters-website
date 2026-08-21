// TS: 2026-08-21 16:35 ET

import assert from "node:assert/strict";
import test from "node:test";
import { runRatingBatch } from "../src/jobs/rating-batch.js";
import type { DailyMarketHistory, MarketDataProvider } from "../src/providers/types.js";
import type { RatingBatchAccounting, RatingBatchStore } from "../src/ratings/batch-store.js";
import type { PersistenceStore } from "../src/database/persistence.js";
import type { SecDataProvider } from "../src/sec/types.js";

function benchmarkHistory(): DailyMarketHistory {
  return Object.freeze({
    symbol: "SPY",
    provider: "test-market",
    retrievedAt: "2026-08-21T20:35:00.000Z",
    feedDisclosure: "Test history.",
    bars: Object.freeze([]),
  });
}

test("rating batch waits and retries a transient market-provider limit", async () => {
  let marketCalls = 0;
  let finished: RatingBatchAccounting | null = null;

  const marketProvider = {
    name: "test-market",
    configured: true,
    async getDailyHistory() {
      marketCalls += 1;
      if (marketCalls === 1) throw new Error("API credits rate limit reached");
      return benchmarkHistory();
    },
  } as unknown as MarketDataProvider;

  const secProvider = {
    name: "test-sec",
    configured: true,
  } as unknown as SecDataProvider;

  const persistenceStore = {
    name: "test-db",
    configured: true,
  } as unknown as PersistenceStore;

  const batchStore = {
    name: "test-db",
    configured: true,
    async listCandidates() { return []; },
    async startRun() { return "retry-test"; },
    async finishRun(_runId: string, accounting: RatingBatchAccounting) { finished = accounting; },
  } as unknown as RatingBatchStore;

  const accounting = await runRatingBatch(
    { marketProvider, secProvider, persistenceStore, batchStore },
    {
      targetCount: 1,
      candidateLimit: 1,
      marketRequestDelayMs: 0,
      marketLimitRetryMs: 0,
      marketLimitMaxRetries: 1,
    },
  );

  assert.equal(marketCalls, 2);
  assert.equal(accounting.ratedCount, 0);
  assert.match(accounting.stoppedReason ?? "", /candidate reserve exhausted/i);
  assert.deepEqual(finished, accounting);
});
