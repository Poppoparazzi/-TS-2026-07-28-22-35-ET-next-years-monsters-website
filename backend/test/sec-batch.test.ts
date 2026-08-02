// TS: 2026-08-02 15:12 ET

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
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecDataProvider,
  SecFilingSummary,
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
  public closed = false;

  public async claim(
    _limit: number,
    _maxAgeHours: number,
  ): Promise<readonly SecBatchCandidate[]> {
    return Object.freeze([
      Object.freeze({ ticker: "AAPL", attemptCount: 1 }),
      Object.freeze({ ticker: "FAIL", attemptCount: 2 }),
      Object.freeze({ ticker: "NVDA", attemptCount: 1 }),
    ]);
  }

  public async markComplete(ticker: string): Promise<void> {
    this.completed.push(ticker);
  }

  public async markFailed(ticker: string, message: string): Promise<void> {
    this.failed.push({ ticker, message });
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

  return Object.freeze({
    symbol,
    quoteStatus: "unconfigured",
    filingCount: 1,
    factCount: 2,
    stored: storedSnapshot(symbol),
    completedAt: "2026-08-02T19:00:00.000Z",
  });
}

test("bulk SEC workers isolate one failure and complete the remaining companies", async () => {
  const queue = new MemoryQueue();
  const persistenceStore = new MemoryPersistence();

  const summary = await runSecUniverseBatch(
    testConfig(),
    { batchSize: 100, concurrency: 3, maxAgeHours: 24 },
    {
      queue,
      persistenceStore,
      secProvider: new ConfiguredSecProvider(),
      marketProvider: new UnconfiguredMarketDataProvider(),
      refreshSymbol: refreshOverride,
    },
  );

  assert.equal(summary.status, "completed");
  assert.equal(summary.claimedCount, 3);
  assert.equal(summary.succeededCount, 2);
  assert.equal(summary.failedCount, 1);
  assert.deepEqual(queue.completed.sort(), ["AAPL", "NVDA"]);
  assert.deepEqual(queue.failed, [
    { ticker: "FAIL", message: "Synthetic SEC failure." },
  ]);
  assert.equal(summary.failures[0]?.attemptCount, 2);
  assert.equal(queue.closed, true);
  assert.equal(persistenceStore.closed, true);
});
