// TS: 2026-08-21 15:16 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { parseSecUniversePayload } from "../src/universe/sec-source.js";
import {
  classifyUniverseDirectoryStatus,
  DEACTIVATE_UNIVERSE_SQL,
  UPSERT_UNIVERSE_COMPANY_SQL,
} from "../src/universe/store.js";
import type {
  UniverseCompany,
  UniverseDirectorySearch,
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
  public searchQuery = "";
  public searchLimit = 0;
  public evidenceReadyOnly = false;

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
      candidatesExaminedCount: 1,
      queuedCount: 1,
      processingCount: 0,
      secCompleteCount: 1,
      secEvidenceReadyCount: 1,
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
      finalUsableUniverseCount: 1,
      incompleteCount: 2,
      protectedTickerCount: 30,
      protectedPresentCount: 2,
      protectedMissingCount: 28,
      protectedMissingTickers: Object.freeze([]),
      protectedMustRepairCount: 0,
      protectedMustRepairTickers: Object.freeze([]),
      replaceableFailureCount: 0,
      replaceableFailureTickers: Object.freeze([]),
      replacementsAttemptedCount: 0,
      reserveCandidatesRemainingCount: 1,
      companies: Object.freeze([]),
    });
  }

  public async searchCompanies(
    query: string,
    limit: number,
    evidenceReadyOnly: boolean,
  ): Promise<UniverseDirectorySearch> {
    this.searchQuery = query;
    this.searchLimit = limit;
    this.evidenceReadyOnly = evidenceReadyOnly;
    return Object.freeze({
      query,
      universeSize: 5_000,
      secEvidenceReadyCount: 3_355,
      protectedTickerCount: 30,
      protectedMustRepairCount: 0,
      replaceableFailureCount: 281,
      results: Object.freeze([
        Object.freeze({
          ticker: "AAPL",
          companyName: "Apple Inc.",
          exchange: "Nasdaq",
          secCik: "0000320193",
          isProtected: true,
          secEvidenceReady: true,
          ratingAvailable: false,
          status: "evidence_ready" as const,
        }),
      ]),
    });
  }

  public async close(): Promise<void> {}
}

test("SEC universe parser preserves source priority, limits, and deduplicates tickers", () => {
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

test("SEC universe parser retains protected share classes beyond the ordinary limit", () => {
  const companies = parseSecUniversePayload(
    {
      fields: ["cik", "name", "ticker", "exchange"],
      data: [
        [1652044, "Alphabet Class A", "GOOGL", "Nasdaq"],
        [1, "Ordinary One", "ONE", "NYSE"],
        [2, "Ordinary Two", "TWO", "NYSE"],
        [1652044, "Alphabet Class C", "GOOG", "Nasdaq"],
      ],
    },
    3,
    "https://example.test/sec-universe.json",
  );

  assert.equal(companies.length, 3);
  assert.deepEqual(companies.map((company) => company.ticker), ["GOOGL", "ONE", "GOOG"]);
  assert.equal(companies[0]?.cik, companies[2]?.cik);
});

test("bulk universe import preserves protected candidates and supports shared issuer CIKs", () => {
  assert.match(DEACTIVATE_UNIVERSE_SQL, /UPDATE companies/);
  assert.match(DEACTIVATE_UNIVERSE_SQL, /SET is_active = false/);
  assert.match(DEACTIVATE_UNIVERSE_SQL, /AND NOT \(c\.is_pilot = true OR c\.ticker IN/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$1::varchar\(15\)/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$2::text/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$3::text/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /\$4::varchar\(10\)/);
  assert.doesNotMatch(UPSERT_UNIVERSE_COMPANY_SQL, /existing\.sec_cik/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /sec_cik = EXCLUDED\.sec_cik/);
  assert.match(UPSERT_UNIVERSE_COMPANY_SQL, /clock_timestamp\(\)/);
});

test("public directory keeps protected failures on repair and ordinary failures replaceable", () => {
  assert.equal(
    classifyUniverseDirectoryStatus({
      secEvidenceReady: false,
      isProtected: true,
      secStage: "failed",
    }),
    "protected_must_repair",
  );
  assert.equal(
    classifyUniverseDirectoryStatus({
      secEvidenceReady: false,
      isProtected: false,
      secStage: "unresolved",
    }),
    "replaceable_exception",
  );
  assert.equal(
    classifyUniverseDirectoryStatus({
      secEvidenceReady: true,
      isProtected: true,
      secStage: "complete",
    }),
    "evidence_ready",
  );
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
  assert.equal(response.json().candidatesExaminedCount, 1);
  assert.equal(response.json().queuedCount, 1);
  assert.equal(response.json().secCompleteCount, 1);
  assert.equal(response.json().secEvidenceReadyCount, 1);
  assert.equal(response.json().unresolvedCount, 0);
  assert.equal(response.json().secIdentityCount, 2);
  assert.equal(response.json().quoteCompleteCount, 0);
  assert.equal(response.json().finalUsableUniverseCount, 1);
  assert.equal(response.json().replaceableFailureCount, 0);
});

test("public universe search exposes broad evidence-ready directory results", async (t) => {
  const universeStore = new MemoryUniverseStore();
  const app = await buildApp({
    config: testConfig(),
    universeStore,
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/universe/search?q=Apple&limit=999&evidenceReady=true",
  });

  const payload = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(universeStore.searchQuery, "Apple");
  assert.equal(universeStore.searchLimit, 25);
  assert.equal(universeStore.evidenceReadyOnly, true);
  assert.equal(response.headers["cache-control"], "public, max-age=30, stale-while-revalidate=120");
  assert.deepEqual(payload, {
    query: "Apple",
    count: 1,
    evidenceReadyOnly: true,
    results: [
      {
        ticker: "AAPL",
        companyName: "Apple Inc.",
        exchange: "Nasdaq",
        secCik: "0000320193",
        isProtected: true,
        secEvidenceReady: true,
        ratingAvailable: false,
        status: "evidence_ready",
      },
    ],
    universe: {
      candidateCount: 5_000,
      secEvidenceReadyCount: 3_355,
      protectedTickerCount: 30,
      protectedMustRepairCount: 0,
      replaceableFailureCount: 281,
    },
    retrievedAt: payload.retrievedAt,
  });
});

test("public universe search permits an empty query for lightweight live totals", async (t) => {
  const universeStore = new MemoryUniverseStore();
  const app = await buildApp({
    config: testConfig(),
    universeStore,
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/universe/search?limit=12",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(universeStore.searchQuery, "");
  assert.equal(response.json().universe.secEvidenceReadyCount, 3_355);
});

test("public universe search rejects oversized queries before database work", async (t) => {
  const universeStore = new MemoryUniverseStore();
  const app = await buildApp({
    config: testConfig(),
    universeStore,
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: `/api/universe/search?q=${"A".repeat(101)}`,
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "query_too_long");
  assert.equal(universeStore.searchQuery, "");
});
