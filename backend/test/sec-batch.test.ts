// TS: 2026-08-18 05:02 ET

import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "../src/config.js";
import type {
  PersistenceStore,
  StoredCompanySnapshot,
} from "../src/database/persistence.js";
import type {
  PilotRefreshDependencies,
  PilotRefreshResult,
} from "../src/jobs/pilot-refresh.js";
import { UnconfiguredMarketDataProvider } from "../src/providers/unconfigured.js";
import {
  type SecCompany,
  type SecCompanyFactsSummary,
  type SecDataProvider,
  SecEdgarRequestError,
  type SecFilingSummary,
} from "../src/sec/types.js";
import type {
  SecBatchCandidate,
  SecBatchQueue,
} from "../src/universe/sec-batch-queue.js";
import { runSecUniverseBatch } from "../src/universe/sec-batch-processor.js";

function testConfig(): AppConfig {
  return Object.freeze({
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 8787,
    corsOrigins: Object.freeze([]),
    marketDataProvider: "unconfigured",
    twelveDataApiKey: null,
    secUserAgent: null,
    databaseUrl: null,
  });
}

class MemoryQueue implements SecBatchQueue {
  public readonly name = "memory-queue";
  public readonly configured = true;
  public readonly completed: string[] = [];
  public readonly failed: { ticker: string; message: string }[] = [];
  public readonly unresolved: { ticker: string; message: string }[] = [];
  public readonly claimLimits: number[] = [];
  public closed = false;
  private readonly candidates: SecBatchCandidate[] = [
    Object.freeze({ ticker: "AAPL", attemptCount: 1 }),
    Object.freeze({ ticker: "FAIL", attemptCount: 2 }),
    Object.freeze({ ticker: "NOSEC", attemptCount: 1 }),
    Object.freeze({ ticker: "NVDA", attemptCount: 1 }),
  ];

  public async claim(
    limit: number,
    _maxAgeHours: number,
  ): Promise<readonly SecBatchCandidate[]> {
    this.claimLimits.push(limit);
    return Object.freeze(this.candidates.splice(0, limit));
  }

  public async markComplete(ticker: string): Promise<void> {
    this.completed.push(ticker);
  }

  public async markFailed(ticker: string, message: string): Promise<void> {
    this.failed.push({ ticker, message });
  }

  public async markUnresolved(ticker: string, message: string): Promise<void> {
    this.unresolved.push({ ticker, message });
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

class MemoryPersistence implements PersistenceStore {
  public readonly name = "memory-persistence";
  public readonly configured = true;
  public closed = false;

  public async saveQuote(): Promise<void> {}
  public async saveSecCompany(_company: SecCompany): Promise<void> {}
  public async saveSecFilings(
    _company: SecCompany,
    _filings: readonly SecFilingSummary[],
  ): Promise<void> {}
  public async saveSecFacts(_summary: SecCompanyFactsSummary): Promise<void> {}
  public async getStoredCompany(_symbol: string): Promise<StoredCompanySnapshot | null> {
    return null;
  }
  public async close(): Promise<void> {
    this.closed = true;
  }
}

class ConfiguredSecProvider implements SecDataProvider {
  public readonly name = "configured-test-sec";
  public readonly configured = true;

  public async getCompany(_symbol: string): Promise<SecCompany> {
    throw new Error("Test refresh override should handle this call.");
  }
  public async getRecentFilings(
    _symbol: string,
    _limit?: number,
  ): Promise<readonly SecFilingSummary[]> {
    throw new Error("Test refresh override should handle this call.");
  }
  public async getCompanyFacts(_symbol: string): Promise<SecCompanyFactsSummary> {
    throw new Error("Test refresh override should handle this call.");
  }
}

function storedSnapshot(ticker: string): StoredCompanySnapshot {
  return Object.freeze({
    ticker,
    companyName: `${ticker} Test Company`,
    exchange: "NASDAQ",
    currency: "USD",
    secCik: "0000000001",
    updatedAt: "2026-08-02T19:00:00.000Z",
    latestQuote: null,
    latestFiling: null,
    filingCount: 1,
    factCount: 2,
    ratingCount: 0,
  });
}

async function refreshOverride(
  symbol: string,
  _dependencies: PilotRefreshDependencies,
): Promise<PilotRefreshResult> {
  if (symbol === "FAIL") throw new Error("Synthetic SEC failure.");
  if (symbol === "NOSEC") throw new SecEdgarRequestError(404);

  return Object.freeze({
    symbol,
    quoteStatus: "unconfigured",
    filingCount: 1,
    factCount: 2,
    stored: storedSnapshot(symbol),
    completedAt: "2026-08-02T19:00:00.000Z",
  });
}

test("bulk SEC workers support a 5000-company reserve target while using recoverable waves", async () => {
  const queue = new MemoryQueue();
  const persistenceStore = new MemoryPersistence();

  const summary = await runSecUniverseBatch(
    testConfig(),
    { batchSize: 5_000, concurrency: 3, maxAgeHours: 24 },
    {
      queue,
      persistenceStore,
      secProvider: new ConfiguredSecProvider(),
      marketProvider: new UnconfiguredMarketDataProvider(),
      refreshSymbol: refreshOverride,
    },
  );

  assert.equal(summary.status, "completed");
  assert.equal(summary.requestedBatchSize, 5_000);
  assert.equal(summary.claimedCount, 4);
  assert.equal(summary.succeededCount, 2);
  assert.equal(summary.unresolvedCount, 1);
  assert.equal(summary.failedCount, 1);
  assert.deepEqual(summary.unresolvedTickers, ["NOSEC"]);
  assert.deepEqual(queue.completed.sort(), ["AAPL", "NVDA"]);
  assert.deepEqual(queue.unresolved, [
    { ticker: "NOSEC", message: "SEC EDGAR request failed with HTTP 404." },
  ]);
  assert.deepEqual(queue.failed, [
    { ticker: "FAIL", message: "Synthetic SEC failure." },
  ]);
  assert.equal(summary.failures[0]?.attemptCount, 2);
  assert.deepEqual(queue.claimLimits, [3, 3, 3]);
  assert.equal(queue.closed, true);
  assert.equal(persistenceStore.closed, true);
});

test("bulk SEC workers mark a duplicate active SEC identity unresolved", async () => {
  const queue = new MemoryQueue();
  const persistenceStore = new MemoryPersistence();

  async function duplicateIdentityRefresh(
    symbol: string,
    dependencies: PilotRefreshDependencies,
  ): Promise<PilotRefreshResult> {
    if (symbol === "AAPL") {
      throw Object.assign(
        new Error('duplicate key value violates unique constraint "companies_sec_cik_unique"'),
        { code: "23505", constraint: "companies_sec_cik_unique" },
      );
    }
    return refreshOverride(symbol, dependencies);
  }

  const summary = await runSecUniverseBatch(
    testConfig(),
    { batchSize: 1, concurrency: 1, maxAgeHours: 24 },
    {
      queue,
      persistenceStore,
      secProvider: new ConfiguredSecProvider(),
      marketProvider: new UnconfiguredMarketDataProvider(),
      refreshSymbol: duplicateIdentityRefresh,
    },
  );

  assert.equal(summary.succeededCount, 0);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.unresolvedCount, 1);
  assert.deepEqual(summary.unresolvedTickers, ["AAPL"]);
  assert.deepEqual(queue.failed, []);
  assert.deepEqual(queue.unresolved, [
    {
      ticker: "AAPL",
      message: 'duplicate key value violates unique constraint "companies_sec_cik_unique"',
    },
  ]);
});

test("bulk SEC workers recover a wrapped duplicate SEC identity from the exact constraint message", async () => {
  const queue = new MemoryQueue();
  const persistenceStore = new MemoryPersistence();

  async function wrappedDuplicateIdentityRefresh(
    symbol: string,
    dependencies: PilotRefreshDependencies,
  ): Promise<PilotRefreshResult> {
    if (symbol === "AAPL") {
      throw new Error('duplicate key value violates unique constraint "companies_sec_cik_unique"');
    }
    return refreshOverride(symbol, dependencies);
  }

  const summary = await runSecUniverseBatch(
    testConfig(),
    { batchSize: 1, concurrency: 1, maxAgeHours: 24 },
    {
      queue,
      persistenceStore,
      secProvider: new ConfiguredSecProvider(),
      marketProvider: new UnconfiguredMarketDataProvider(),
      refreshSymbol: wrappedDuplicateIdentityRefresh,
    },
  );

  assert.equal(summary.succeededCount, 0);
  assert.equal(summary.failedCount, 0);
  assert.equal(summary.unresolvedCount, 1);
  assert.deepEqual(summary.unresolvedTickers, ["AAPL"]);
  assert.deepEqual(queue.failed, []);
  assert.deepEqual(queue.unresolved, [
    {
      ticker: "AAPL",
      message: 'duplicate key value violates unique constraint "companies_sec_cik_unique"',
    },
  ]);
});
