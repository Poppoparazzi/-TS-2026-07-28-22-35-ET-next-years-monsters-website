// TS: 2026-08-10 02:04 UTC

import assert from "node:assert/strict";
import test from "node:test";
import type { ProductionRatingAssemblySource } from "../src/ratings/production-input.js";
import type {
  RatingReadStore,
  RatingReadStoreStatus,
} from "../src/ratings/read-store.js";
import {
  evaluateSingleSymbolProductionRating,
  type SingleSymbolEvidenceLoader,
} from "../src/ratings/single-symbol-orchestrator.js";
import type {
  RatingWriteStore,
  SavedRatingResult,
} from "../src/ratings/write-store.js";
import type { ProductionRatingResult } from "../src/ratings/types.js";

const fixedNow = new Date("2026-08-10T02:04:00.000Z");

function incompleteSource(symbol: string, calculatedAt: string): ProductionRatingAssemblySource {
  return {
    symbol,
    companyName: "Apple Inc.",
    exchange: "NASDAQ",
    securityType: "Common Stock",
    secIdentityResolved: true,
    secCik: "0000320193",
    secFacts: {
      cik: "0000320193",
      companyName: "Apple Inc.",
      retrievedAt: calculatedAt,
      facts: {},
      sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
      disclosure: "SEC company facts",
    },
    companyMarket: {
      providerName: null,
      providerConfigured: false,
      fetchedAt: null,
      symbol,
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
    calculatedAt,
  };
}

class RecordingWriteStore implements RatingWriteStore {
  public readonly configured = true;
  public saved: ProductionRatingResult | null = null;

  public async saveResult(result: ProductionRatingResult): Promise<SavedRatingResult> {
    this.saved = result;
    return { ratingRunId: null, eligibilityResultId: "701" };
  }

  public async close(): Promise<void> {}
}

class WriteBackReadStore implements RatingReadStore {
  public readonly configured = true;

  public constructor(private readonly writeStore: RecordingWriteStore) {}

  public async getCurrent(): Promise<Record<string, unknown> | null> {
    return this.writeStore.saved ? { ...this.writeStore.saved } : null;
  }

  public async getHistory(): Promise<readonly Record<string, unknown>[]> {
    return Object.freeze([]);
  }

  public async getStatus(): Promise<RatingReadStoreStatus> {
    return Object.freeze({
      configured: true,
      schemaReady: true,
      ratedCount: 0,
      eligibilityCount: this.writeStore.saved ? 1 : 0,
      latestCalculatedAt: null,
      message: "test",
    });
  }

  public async close(): Promise<void> {}
}

class RecordingEvidenceLoader implements SingleSymbolEvidenceLoader {
  public readonly configured = true;
  public calls: Array<{ symbol: string; calculatedAt: string }> = [];

  public async load(symbol: string, calculatedAt: string): Promise<ProductionRatingAssemblySource> {
    this.calls.push({ symbol, calculatedAt });
    return incompleteSource(symbol, calculatedAt);
  }
}

test("single-symbol orchestration normalizes ticker and persists fail-closed result", async () => {
  const evidenceLoader = new RecordingEvidenceLoader();
  const writeStore = new RecordingWriteStore();
  const readStore = new WriteBackReadStore(writeStore);

  const result = await evaluateSingleSymbolProductionRating("  aapl  ", {
    evidenceLoader,
    writeStore,
    readStore,
    now: () => fixedNow,
  });

  assert.deepEqual(evidenceLoader.calls, [
    { symbol: "AAPL", calculatedAt: "2026-08-10T02:04:00.000Z" },
  ]);
  assert.equal(result.evaluation.ready, false);
  assert.equal(result.publicResult.symbol, "AAPL");
  assert.equal(result.publicResult.eligible, false);
  assert.equal(result.publicResult.score, null);
  assert.equal(result.publicResult.tier, null);
  assert.equal(result.publicResult.summary, "Not Yet Rated");
});

test("single-symbol orchestration rejects unsupported ticker characters before loading evidence", async () => {
  const evidenceLoader = new RecordingEvidenceLoader();
  const writeStore = new RecordingWriteStore();
  const readStore = new WriteBackReadStore(writeStore);

  await assert.rejects(
    evaluateSingleSymbolProductionRating("AAPL<script>", {
      evidenceLoader,
      writeStore,
      readStore,
      now: () => fixedNow,
    }),
    /unsupported characters/i,
  );
  assert.equal(evidenceLoader.calls.length, 0);
  assert.equal(writeStore.saved, null);
});

test("single-symbol orchestration rejects evidence returned for a different ticker", async () => {
  const writeStore = new RecordingWriteStore();
  const readStore = new WriteBackReadStore(writeStore);
  const evidenceLoader: SingleSymbolEvidenceLoader = {
    configured: true,
    async load(_symbol, calculatedAt) {
      return incompleteSource("MSFT", calculatedAt);
    },
  };

  await assert.rejects(
    evaluateSingleSymbolProductionRating("AAPL", {
      evidenceLoader,
      writeStore,
      readStore,
      now: () => fixedNow,
    }),
    /identity mismatch.*AAPL.*MSFT/i,
  );
  assert.equal(writeStore.saved, null);
});

test("single-symbol orchestration rejects evidence timestamp drift", async () => {
  const writeStore = new RecordingWriteStore();
  const readStore = new WriteBackReadStore(writeStore);
  const evidenceLoader: SingleSymbolEvidenceLoader = {
    configured: true,
    async load(symbol) {
      return incompleteSource(symbol, "2026-08-10T02:03:59.000Z");
    },
  };

  await assert.rejects(
    evaluateSingleSymbolProductionRating("AAPL", {
      evidenceLoader,
      writeStore,
      readStore,
      now: () => fixedNow,
    }),
    /timestamp mismatch/i,
  );
  assert.equal(writeStore.saved, null);
});
