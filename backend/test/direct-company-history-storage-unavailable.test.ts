// TS: 2026-09-14 04:03 UTC

import assert from "node:assert/strict";
import test from "node:test";
import type { MarketDataProvider } from "../src/providers/types.js";
import type { RatingBatchStore } from "../src/ratings/batch-store.js";
import { loadDirectCompanyHistoryWithLease } from "../src/ratings/direct-company-history.js";

test("direct paid history fails closed when durable market-history storage is unavailable", async () => {
  let paidCalls = 0;
  let claimCalls = 0;

  const marketProvider = {
    name: "twelve-data",
    configured: true,
    async searchTickers() { return []; },
    async getQuote() { throw new Error("not used"); },
    async getCachedDailyHistory() { return null; },
    async getDailyHistory() {
      paidCalls += 1;
      throw new Error("paid provider must not be called");
    },
  } as MarketDataProvider;

  const batchStore = {
    configured: false,
    async tryClaimMarketHistoryRequest() {
      claimCalls += 1;
      return true;
    },
    async getReusableMarketHistorySuppression() { return null; },
    async releaseMarketHistoryRequestClaim() { return true; },
    async saveMarketHistoryEvidence() { throw new Error("not expected"); },
  } as unknown as RatingBatchStore;

  const result = await loadDirectCompanyHistoryWithLease({
    marketProvider,
    batchStore,
    ticker: "NODB",
    runId: "direct-test",
  });

  assert.equal(result.status, "persistence_unavailable");
  assert.equal(result.claimAcquired, false);
  assert.equal(result.eligibilityCode, "market_history_persistence_unavailable");
  assert.equal(claimCalls, 0);
  assert.equal(paidCalls, 0);
});
