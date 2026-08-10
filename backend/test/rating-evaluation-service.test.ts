// TS: 2026-08-09 18:48 ET

import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAndPersistProductionRating } from "../src/ratings/evaluation-service.js";
import type { ProductionRatingAssemblySource } from "../src/ratings/production-input.js";
import type {
  RatingWriteStore,
  SavedRatingResult,
} from "../src/ratings/write-store.js";
import type { ProductionRatingResult } from "../src/ratings/types.js";

const incompleteSource: ProductionRatingAssemblySource = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  exchange: "NASDAQ",
  securityType: "Common Stock",
  secIdentityResolved: true,
  secCik: "0000320193",
  secFacts: {
    cik: "0000320193",
    companyName: "Apple Inc.",
    retrievedAt: "2026-08-09T20:55:00Z",
    facts: {},
    sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
    disclosure: "SEC company facts",
  },
  companyMarket: {
    providerName: null,
    providerConfigured: false,
    fetchedAt: null,
    symbol: "AAPL",
    bars: [],
  },
  benchmarkMarket: {
    providerName: null,
    providerConfigured: false,
    fetchedAt: null,
    symbol: "SPY",
    bars: [],
  },
  benchmarkSymbol: "SPY",
  riskEvidence: {
    verified: false,
    checkedAt: null,
    source: null,
    flags: [],
  },
  calculatedAt: "2026-08-09T22:48:00.000Z",
};

class RecordingStore implements RatingWriteStore {
  public readonly configured = true;
  public savedResult: ProductionRatingResult | null = null;

  public async saveResult(result: ProductionRatingResult): Promise<SavedRatingResult> {
    this.savedResult = result;
    return { ratingRunId: null, eligibilityResultId: "501" };
  }

  public async close(): Promise<void> {}
}

test("fail-closed evaluation is persisted as Not Yet Rated rather than a score", async () => {
  const store = new RecordingStore();
  const persisted = await evaluateAndPersistProductionRating(incompleteSource, store);

  assert.equal(persisted.evaluation.ready, false);
  assert.deepEqual(persisted.saved, {
    ratingRunId: null,
    eligibilityResultId: "501",
  });
  assert.ok(store.savedResult);
  assert.equal(store.savedResult?.eligible, false);
  assert.equal(store.savedResult?.score, null);
  assert.equal(store.savedResult?.tier, null);
  assert.equal(store.savedResult?.summary, "Not Yet Rated");
  assert.equal(store.savedResult?.eligibilityCode, "incomplete_evidence");
});

test("unconfigured persistence blocks evaluation writes explicitly", async () => {
  const store: RatingWriteStore = {
    configured: false,
    async saveResult(): Promise<SavedRatingResult> {
      throw new Error("saveResult should not be called");
    },
    async close(): Promise<void> {},
  };

  await assert.rejects(
    evaluateAndPersistProductionRating(incompleteSource, store),
    /Production rating database is not configured/,
  );
});
