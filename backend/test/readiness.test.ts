// TS: 2026-07-29 21:51 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type {
  DatabaseReadinessProvider,
  RolloutReadinessSnapshot,
} from "../src/database/readiness.js";

function testConfig(): AppConfig {
  return Object.freeze({
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 8787,
    corsOrigins: Object.freeze(["https://example.test"]),
    marketDataProvider: "unconfigured",
    twelveDataApiKey: null,
    secUserAgent: null,
    databaseUrl: null,
  });
}

const SNAPSHOT: RolloutReadinessSnapshot = Object.freeze({
  configured: true,
  generatedAt: "2026-07-29T21:50:00.000Z",
  pilot: Object.freeze({
    requiredCompanyCount: 15,
    candidateCompanyCount: 15,
    readyCompanyCount: 1,
    pendingCompanyCount: 14,
    companiesStillToAdd: 0,
    companiesFailingChecks: 14,
    isLiveReady: false,
    lastSuccessfulUpdate: "2026-07-29T21:49:00.000Z",
    pendingTickers: Object.freeze(["AMD", "AMZN"]),
  }),
  top25: Object.freeze({
    requiredCompanyCount: 25,
    candidateCompanyCount: 15,
    readyCompanyCount: 1,
    pendingCompanyCount: 24,
    companiesStillToAdd: 10,
    companiesFailingChecks: 14,
    isLiveReady: false,
    lastSuccessfulUpdate: "2026-07-29T21:49:00.000Z",
    pendingTickers: Object.freeze(["AMD", "AMZN"]),
  }),
  companies: Object.freeze([
    Object.freeze({
      ticker: "AAPL",
      companyName: "Apple",
      hasVerifiedQuote: true,
      quoteIsUsable: true,
      hasSecStatus: true,
      hasSavedVersionedRating: true,
      hasRatingEvidence: true,
      isLiveReady: true,
      lastSuccessfulUpdate: "2026-07-29T21:49:00.000Z",
    }),
  ]),
});

class StaticReadinessProvider implements DatabaseReadinessProvider {
  public readonly name = "static-readiness-test";
  public readonly configured = true;
  public closed = false;

  public async getSnapshot(): Promise<RolloutReadinessSnapshot> {
    return SNAPSHOT;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

test("readiness route exposes saved progress without database credentials", async () => {
  const readinessProvider = new StaticReadinessProvider();
  const app = await buildApp({
    config: testConfig(),
    readinessProvider,
    logger: false,
  });

  const response = await app.inject({ method: "GET", url: "/api/readiness" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.configured, true);
  assert.equal(payload.pilot.readyCompanyCount, 1);
  assert.equal(payload.top25.companiesStillToAdd, 10);
  assert.equal(payload.companies[0].ticker, "AAPL");
  assert.equal(payload.companies[0].isLiveReady, true);
  assert.equal(response.body.includes("postgres://"), false);

  await app.close();
  assert.equal(readinessProvider.closed, true);
});
