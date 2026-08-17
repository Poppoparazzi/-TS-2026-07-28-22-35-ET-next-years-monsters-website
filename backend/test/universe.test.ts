// TS: 2026-08-17 19:02 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { parseSecUniversePayload } from "../src/universe/sec-source.js";
import {
  DEACTIVATE_UNIVERSE_SQL,
  RELEASE_INACTIVE_CIK_SQL,
  UPSERT_UNIVERSE_COMPANY_SQL,
} from "../src/universe/store.js";
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
      queuedCount: 1,
      processingCount: 0,
      secCompleteCount: 1,
      partialCount: 0,
      failedCount: 0,
      staleCount: 0,
      unresolvedCount: 0,
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

test("SEC universe parser preserves source priority, limits, and deduplicates ticker and CIK", () => {
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
    ["ZETA", "AAA"],
  );
  assert.deepEqual(
    companies.map((company) => company.cikPadded),
    ["0000000003", "0000000001"],
  );
  assert.equal(companies[0]?.sourceUrl, "https://example.test/sec-universe.json");
});

test("bulk universe import replaces the active candidate set and safely transfers inactive CIKs", () => {
  assert.match(DEACTIVATE_UNIVERSE_SQL, /UPDATE companies/);
  assert.match(DEACTIVATE_UNIVERSE_SQL, /SET is_active = false/);
  assert.match(RELEASE_INACTIVE_CIK_SQL, /UPDATE companies/);
  assert.match(RELEASE_INACTIVE_CIK_SQL, /sec_cik = NULL/);
  assert.match(RELEASE_INACTIVE_CIK_SQL, /is_active = false/);
  assert.match(RELEASE_INACTIVE_CIK_SQL, /ticker <> \$2::varchar\(15\)/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$1::varchar\(15\)/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$2::text/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$3::text/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$4::varchar\(10\)/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /NULL::varchar\(10\)/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /existing\.is_active = true/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /clock_timestamp\(\)/);
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
  assert.equal(universeStore.requestedLimit, 5_000);
  assert.equal(response.json().universeSize, 100);
  assert.equal(response.json().queuedCount, 1);
  assert.equal(response.json().secCompleteCount, 1);
  assert.equal(response.json().unresolvedCount, 0);
  assert.equal(response.json().secIdentityCount, 2);
  assert.equal(response.json().quoteCompleteCount, 0);
});
