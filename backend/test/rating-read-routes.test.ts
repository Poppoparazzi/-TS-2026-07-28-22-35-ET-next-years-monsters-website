// TS: 2026-08-09 11:07 ET

import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { registerRatingReadRoutes } from "../src/ratings/read-routes.js";
import type {
  RatingReadStore,
  RatingReadStoreStatus,
} from "../src/ratings/read-store.js";

const storedRating = Object.freeze({
  symbol: "TEST",
  companyName: "Test Corporation",
  engineVersion: "nym-rating-v1.0.0",
  calculatedAt: "2026-08-09T15:00:00.000Z",
  dataAsOf: "2026-08-08",
  dataCompletenessScore: 100,
  eligible: true,
  eligibilityCode: "eligible",
  score: 88,
  tier: "Gold",
});

class MemoryRatingReadStore implements RatingReadStore {
  public readonly configured = true;
  public closed = false;
  public schemaReady = true;

  public async getCurrent(symbol: string): Promise<Record<string, unknown> | null> {
    return symbol === "TEST" ? storedRating : null;
  }

  public async getHistory(
    symbol: string,
    _limit = 20,
  ): Promise<readonly Record<string, unknown>[]> {
    return symbol === "TEST"
      ? [
          {
            score: 88,
            tier: "Gold",
            engineVersion: "nym-rating-v1.0.0",
            calculatedAt: "2026-08-09T15:00:00.000Z",
          },
        ]
      : [];
  }

  public async getStatus(): Promise<RatingReadStoreStatus> {
    return {
      configured: true,
      schemaReady: this.schemaReady,
      ratedCount: this.schemaReady ? 1 : 0,
      eligibilityCount: 0,
      latestCalculatedAt: this.schemaReady ? "2026-08-09T15:00:00.000Z" : null,
      message: this.schemaReady
        ? "Production rating read path is available."
        : "Database is connected, but production rating tables are not installed yet.",
    };
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

async function testApp() {
  const store = new MemoryRatingReadStore();
  const app = Fastify({ logger: false });
  await registerRatingReadRoutes(app, store);
  return { app, store };
}

test("returns only the stored production rating payload", async (t) => {
  const { app } = await testApp();
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/TEST" });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().score, 88);
  assert.equal(response.json().engineVersion, "nym-rating-v1.0.0");
});

test("missing rating returns Data Incomplete / Not Yet Rated instead of a number", async (t) => {
  const { app } = await testApp();
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/NONE" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().score, null);
  assert.equal(response.json().eligible, false);
  assert.equal(response.json().label, "Data Incomplete / Not Yet Rated");
});

test("missing rating schema is exposed without manufacturing a score", async (t) => {
  const { app, store } = await testApp();
  store.schemaReady = false;
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/NONE" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().schemaReady, false);
  assert.equal(response.json().score, null);
  assert.match(response.json().message, /No score has been invented/i);
});

test("history contains only stored production calculations", async (t) => {
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

test("malformed ticker symbols are rejected", async (t) => {
  const { app } = await testApp();
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/AAPL%24" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "invalid_symbol");
});
