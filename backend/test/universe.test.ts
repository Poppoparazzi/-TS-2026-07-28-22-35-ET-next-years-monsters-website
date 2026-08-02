// TS: 2026-08-02 14:38 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { parseSecUniversePayload } from "../src/universe/sec-source.js";
import type {
  UniverseCompany,
  UniverseImportSummary,
  UniverseStatusSummary,
  UniverseStore,
} from "../src/universe/types.js";

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

class MemoryUniverseStore implements UniverseStore {
  public readonly name = "memory-universe";
  public readonly configured = true;
  public requestedLimit = 0;

  public async importCompanies(
    companies: readonly UniverseCompany[],
  ): Promise<UniverseImportSummary> {
    return Object.freeze({
      requestedCount: companies.length,
      importedCount: companies.length,
      database: this.name,
      sourceUrl: companies[0]?.sourceUrl ?? "test",
      completedAt: "2026-08-02T18:30:00.000Z",
    });
  }

  public async getStatus(limit: number): Promise<UniverseStatusSummary> {
    this.requestedLimit = limit;
    return Object.freeze({
      configured: true,
      generatedAt: "2026-08-02T18:30:00.000Z",
      requestedLimit: limit,
      universeSize: 100,
      examinedCount: 2,
      secIdentityCount: 2,
      filingCompleteCount: 1,
      factsCompleteCount: 1,
      quoteCompleteCount: 0,
      ratingCompleteCount: 0,
      fullyCompleteCount: 0,
      incompleteCount: 2,
      companies: Object.freeze([]),
    });
  }

  public async close(): Promise<void> {}
}

test("SEC universe parser normalizes, sorts, limits, and deduplicates ticker and CIK", () => {
  const companies = parseSecUniversePayload(
    {
      fields: ["cik", "name", "ticker", "exchange"],
      data: [
        [3, "Zeta Corp", "zeta", "NYSE"],
        [1, "Alpha Corp", "aaa", "Nasdaq"],
        [1, "Alpha Class B", "aab", "Nasdaq"],
        [2, "Beta Corp", "bbb", "NYSE"],
        [4, "Invalid", "BAD/ONE", "NYSE"],
      ],
    },
    2,
    "https://example.test/sec-universe.json",
  );

  assert.deepEqual(
    companies.map((company) => company.ticker),
    ["AAA", "BBB"],
  );
  assert.deepEqual(
    companies.map((company) => company.cikPadded),
    ["0000000001", "0000000002"],
  );
  assert.equal(companies[0]?.sourceUrl, "https://example.test/sec-universe.json");
});

test("bulk universe status endpoint caps the requested company count", async (t) => {
  const universeStore = new MemoryUniverseStore();
  const app = await buildApp({
    config: testConfig(),
    universeStore,
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/universe/status?limit=9999",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(universeStore.requestedLimit, 2_500);
  assert.equal(response.json().universeSize, 100);
  assert.equal(response.json().secIdentityCount, 2);
  assert.equal(response.json().quoteCompleteCount, 0);
});
