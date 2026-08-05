// TS: 2026-08-05 08:39 ET

import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerRatingRoutes } from "../src/ratings/routes.js";
import type {
  RatingHistoryEntry,
  RatingStore,
  RatingStoreStatus,
  SavedRatingResult,
} from "../src/ratings/store.js";
import type { ProductionRatingResult } from "../src/ratings/types.js";

const storedResult: ProductionRatingResult = Object.freeze({
  symbol: "TEST",
  companyName: "Test Corporation",
  engineVersion: "nym-rating-v1.0.0",
  calculatedAt: "2026-08-05T12:00:00.000Z",
  dataAsOf: "2026-08-04",
  dataCompletenessScore: 95,
  evidenceInputs: Object.freeze([]),
  eligible: true,
  eligibilityCode: "eligible",
  score: 88,
  tier: "Gold",
  confidence: "high",
  components: Object.freeze([
    {
      key: "monster_dna",
      label: "Monster DNA™",
      score: 90,
      weight: 0.1,
      weightedScore: 9,
      direction: "positive",
      explanation: "Verified quality evidence.",
      evidence: Object.freeze([]),
    },
  ]),
  positiveDrivers: Object.freeze(["Monster DNA™: 90"]),
  negativeDrivers: Object.freeze([]),
  summary: "88 / 100 · Gold.",
  risks: "No component fell below the warning threshold.",
});

class MemoryRatingStore implements RatingStore {
  public readonly name = "memory-rating-store";
  public readonly configured = true;
  public closed = false;

  public async saveResult(_result: ProductionRatingResult): Promise<SavedRatingResult> {
    return { ratingRunId: "1", eligibilityResultId: null };
  }

  public async getCurrent(symbol: string): Promise<ProductionRatingResult | null> {
    return symbol === "TEST" ? storedResult : null;
  }

  public async getHistory(
    symbol: string,
    _limit = 20,
  ): Promise<readonly RatingHistoryEntry[]> {
    return symbol === "TEST"
      ? [
          {
            score: 88,
            tier: "Gold",
            engineVersion: "nym-rating-v1.0.0",
            calculatedAt: "2026-08-05T12:00:00.000Z",
            dataAsOf: "2026-08-04T00:00:00.000Z",
            dataCompletenessScore: 95,
            confidence: "high",
            changeReasons: Object.freeze([]),
          },
        ]
      : [];
  }

  public async getStatus(): Promise<RatingStoreStatus> {
    return {
      configured: true,
      universeCount: 2_000,
      ratedCount: 1,
      unratedCount: 1_999,
      unratedByReason: Object.freeze({ provider_not_connected: 1_999 }),
      latestCalculatedAt: "2026-08-05T12:00:00.000Z",
      activeBatch: null,
    };
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

async function testApp() {
  const store = new MemoryRatingStore();
  const app = Fastify({ logger: false });
  await registerRatingRoutes(app, store);
  return { app, store };
}

test("rating status returns exact stored totals instead of invented zeroes", async (t) => {
  const { app, store } = await testApp();
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/status" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().universeCount, 2_000);
  assert.equal(response.json().ratedCount, 1);
  assert.equal(response.json().unratedByReason.provider_not_connected, 1_999);
  assert.equal(store.closed, false);
});

test("current production rating and components return stored evidence", async (t) => {
  const { app } = await testApp();
  t.after(async () => app.close());

  const current = await app.inject({ method: "GET", url: "/api/ratings/test" });
  assert.equal(current.statusCode, 200);
  assert.equal(current.json().score, 88);
  assert.equal(current.json().tier, "Gold");

  const components = await app.inject({
    method: "GET",
    url: "/api/ratings/TEST/components",
  });
  assert.equal(components.statusCode, 200);
  assert.equal(components.json().components[0].label, "Monster DNA™");
  assert.equal(components.json().reasons.length, 0);
});

test("rating history contains only stored production calculations", async (t) => {
  const { app } = await testApp();
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/ratings/TEST/history?limit=10",
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().count, 1);
  assert.match(response.json().disclosure, /stored production calculations/i);
});

test("rating routes reject malformed symbols and report missing records honestly", async (t) => {
  const { app } = await testApp();
  t.after(async () => app.close());

  const invalid = await app.inject({
    method: "GET",
    url: "/api/ratings/AAPL%2Fsecret",
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.json().error, "invalid_symbol");

  const missing = await app.inject({ method: "GET", url: "/api/ratings/NONE" });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().label, "Not Yet Rated");
});
