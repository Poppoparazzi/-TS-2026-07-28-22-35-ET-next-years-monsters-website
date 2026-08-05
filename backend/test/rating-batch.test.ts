// TS: 2026-08-05 10:08 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  RatingBatchProcessor,
  type RatingBatchSnapshot,
  type RatingBatchStore,
  type RatingBatchWorkItem,
} from "../src/ratings/batch.js";
import type { CoverageCompany } from "../src/ratings/evidence-store.js";
import type { RatingCalculationOutcome } from "../src/ratings/service.js";
import type { ProductionRatingService } from "../src/ratings/service.js";
import type { ProductionRatingResult } from "../src/ratings/types.js";

interface MemoryItem {
  readonly id: string;
  readonly company: CoverageCompany;
  status: "pending" | "processing" | "rated" | "unrated" | "failed" | "cancelled";
  attemptCount: number;
  started: boolean;
  nextRetryAt: string | null;
  lastError: string | null;
}

function company(index: number): CoverageCompany {
  return Object.freeze({
    id: String(index),
    symbol: `T${index}`,
    companyName: `Test Company ${index}`,
    exchange: "NASDAQ",
    securityType: "Common Stock",
    secCik: String(index).padStart(10, "0"),
    secIdentityResolved: true,
  });
}

function eligibleResult(symbol: string): ProductionRatingResult {
  return Object.freeze({
    symbol,
    companyName: symbol,
    engineVersion: "nym-rating-v1.0.0",
    calculatedAt: "2026-08-05T14:00:00.000Z",
    dataAsOf: "2026-08-04",
    dataCompletenessScore: 95,
    evidenceInputs: Object.freeze([]),
    eligible: true,
    eligibilityCode: "eligible",
    score: 88,
    tier: "Gold",
    confidence: "high",
    components: Object.freeze([]),
    positiveDrivers: Object.freeze([]),
    negativeDrivers: Object.freeze([]),
    summary: "88 / 100 · Gold.",
    risks: "Test result.",
  });
}

function outcome(symbol: string): RatingCalculationOutcome {
  return Object.freeze({
    result: eligibleResult(symbol),
    saved: Object.freeze({ ratingRunId: symbol, eligibilityResultId: null }),
    savedSecFactCount: 20,
    savedMarketBarCount: 260,
  });
}

class MemoryBatchStore implements RatingBatchStore {
  public readonly name = "memory-batch";
  public readonly configured = true;
  public readonly items: MemoryItem[];
  public cancellationRequested = false;
  public status: RatingBatchSnapshot["status"] = "running";
  public heartbeatCount = 0;
  private readonly batchId = "1";
  private completedAt: string | null = null;

  public constructor(
    companies: readonly CoverageCompany[],
    private readonly concurrency: number,
  ) {
    this.items = companies.map((value, index) => ({
      id: String(index + 1),
      company: value,
      status: "pending",
      attemptCount: 0,
      started: false,
      nextRetryAt: null,
      lastError: null,
    }));
  }

  private current(): RatingBatchSnapshot {
    const pending = this.items.filter((item) => item.status === "pending");
    return Object.freeze({
      id: this.batchId,
      engineVersion: "nym-rating-v1.0.0",
      status: this.status,
      requestedCount: this.items.length,
      claimedCount: this.items.filter((item) => item.started).length,
      ratedCount: this.items.filter((item) => item.status === "rated").length,
      unratedCount: this.items.filter((item) => item.status === "unrated").length,
      failedCount: this.items.filter((item) => item.status === "failed").length,
      pendingCount: pending.length,
      processingCount: this.items.filter((item) => item.status === "processing").length,
      cancelledCount: this.items.filter((item) => item.status === "cancelled").length,
      concurrency: this.concurrency,
      cancellationRequested: this.cancellationRequested,
      startedAt: "2026-08-05T14:00:00.000Z",
      completedAt: this.completedAt,
      heartbeatAt: "2026-08-05T14:00:00.000Z",
      nextRetryAt: pending
        .map((item) => item.nextRetryAt)
        .filter((value): value is string => value !== null)
        .sort()[0] ?? null,
      failureSummary: null,
    });
  }

  public async createBatch(
    _companies: readonly CoverageCompany[],
    _concurrency: number,
    _engineVersion = "nym-rating-v1.0.0",
  ): Promise<RatingBatchSnapshot> {
    return this.current();
  }

  public async claimWork(
    batchRunId: string,
    limit: number,
    now: string,
    _staleAfterMinutes = 30,
  ): Promise<readonly RatingBatchWorkItem[]> {
    if (this.cancellationRequested || this.status !== "running") return Object.freeze([]);
    const eligible = this.items
      .filter((item) => item.status === "pending")
      .filter((item) => !item.nextRetryAt || item.nextRetryAt <= now)
      .slice(0, limit);
    for (const item of eligible) {
      item.status = "processing";
      item.attemptCount += 1;
      item.started = true;
      item.nextRetryAt = null;
    }
    return Object.freeze(
      eligible.map((item) =>
        Object.freeze({
          id: item.id,
          batchRunId,
          attemptCount: item.attemptCount,
          company: item.company,
        }),
      ),
    );
  }

  public async completeWork(
    item: RatingBatchWorkItem,
    value: RatingCalculationOutcome,
    _now: string,
  ): Promise<void> {
    const stored = this.items.find((candidate) => candidate.id === item.id);
    if (!stored) throw new Error("Missing memory batch item.");
    stored.status = value.result.eligible ? "rated" : "unrated";
  }

  public async retryWork(
    item: RatingBatchWorkItem,
    error: string,
    nextRetryAt: string,
    _now: string,
  ): Promise<void> {
    const stored = this.items.find((candidate) => candidate.id === item.id);
    if (!stored) throw new Error("Missing memory batch item.");
    stored.status = "pending";
    stored.lastError = error;
    stored.nextRetryAt = nextRetryAt;
  }

  public async failWork(
    item: RatingBatchWorkItem,
    error: string,
    _now: string,
  ): Promise<void> {
    const stored = this.items.find((candidate) => candidate.id === item.id);
    if (!stored) throw new Error("Missing memory batch item.");
    stored.status = "failed";
    stored.lastError = error;
  }

  public async requestCancellation(
    _batchRunId: string,
    _now: string,
  ): Promise<RatingBatchSnapshot> {
    this.cancellationRequested = true;
    return this.current();
  }

  public async heartbeat(_batchRunId: string, _now: string): Promise<void> {
    this.heartbeatCount += 1;
  }

  public async finalize(_batchRunId: string, now: string): Promise<RatingBatchSnapshot> {
    if (this.cancellationRequested) {
      for (const item of this.items) {
        if (item.status === "pending") item.status = "cancelled";
      }
    }
    const open = this.items.some(
      (item) => item.status === "pending" || item.status === "processing",
    );
    if (!open) {
      const failed = this.items.filter((item) => item.status === "failed").length;
      const completed = this.items.filter(
        (item) => item.status === "rated" || item.status === "unrated",
      ).length;
      this.status = this.cancellationRequested
        ? "cancelled"
        : failed > 0
          ? completed > 0
            ? "partial"
            : "failed"
          : "completed";
      this.completedAt = now;
    }
    return this.current();
  }

  public async getBatch(_batchRunId: string): Promise<RatingBatchSnapshot> {
    return this.current();
  }

  public async close(): Promise<void> {}
}

class FakeService {
  public active = 0;
  public maximumActive = 0;
  public readonly calls = new Map<string, number>();
  public readonly failuresBeforeSuccess = new Map<string, number>();
  public readonly permanentFailures = new Set<string>();

  public async calculateAndStore(value: CoverageCompany): Promise<RatingCalculationOutcome> {
    this.active += 1;
    this.maximumActive = Math.max(this.maximumActive, this.active);
    const callCount = (this.calls.get(value.symbol) ?? 0) + 1;
    this.calls.set(value.symbol, callCount);
    await Promise.resolve();
    this.active -= 1;

    if (this.permanentFailures.has(value.symbol)) {
      throw new Error(`permanent failure for ${value.symbol}`);
    }
    if (callCount <= (this.failuresBeforeSuccess.get(value.symbol) ?? 0)) {
      throw new Error(`transient failure for ${value.symbol}`);
    }
    return outcome(value.symbol);
  }
}

function processor(
  store: MemoryBatchStore,
  service: FakeService,
  clockState: { value: number },
  maxAttempts = 3,
): RatingBatchProcessor {
  return new RatingBatchProcessor({
    store,
    service: service as unknown as ProductionRatingService,
    maxAttempts,
    baseRetryDelayMs: 1_000,
    maximumRetryDelayMs: 4_000,
    clock: () => new Date(clockState.value),
    sleep: async (milliseconds) => {
      clockState.value += milliseconds;
    },
  });
}

test("rating batch respects bounded concurrency and reconciles every item", async () => {
  const companies = Object.freeze(Array.from({ length: 5 }, (_, index) => company(index + 1)));
  const store = new MemoryBatchStore(companies, 2);
  const service = new FakeService();
  const state = { value: Date.parse("2026-08-05T14:00:00.000Z") };

  const result = await processor(store, service, state).run("1");

  assert.equal(result.status, "completed");
  assert.equal(result.requestedCount, 5);
  assert.equal(result.claimedCount, 5);
  assert.equal(result.ratedCount, 5);
  assert.equal(result.unratedCount, 0);
  assert.equal(result.failedCount, 0);
  assert.equal(result.pendingCount, 0);
  assert.equal(result.processingCount, 0);
  assert.ok(service.maximumActive <= 2);
  assert.equal([...service.calls.values()].every((count) => count === 1), true);
});

test("rating batch retries transient failures without duplicate successful work", async () => {
  const companies = Object.freeze([company(1), company(2)]);
  const store = new MemoryBatchStore(companies, 2);
  const service = new FakeService();
  service.failuresBeforeSuccess.set("T1", 1);
  const state = { value: Date.parse("2026-08-05T14:00:00.000Z") };

  const result = await processor(store, service, state).run("1");

  assert.equal(result.status, "completed");
  assert.equal(result.ratedCount, 2);
  assert.equal(service.calls.get("T1"), 2);
  assert.equal(service.calls.get("T2"), 1);
  assert.equal(store.items.find((item) => item.company.symbol === "T1")?.attemptCount, 2);
});

test("rating batch isolates permanent failures and finishes partial", async () => {
  const companies = Object.freeze([company(1), company(2)]);
  const store = new MemoryBatchStore(companies, 2);
  const service = new FakeService();
  service.permanentFailures.add("T2");
  const state = { value: Date.parse("2026-08-05T14:00:00.000Z") };

  const result = await processor(store, service, state, 2).run("1");

  assert.equal(result.status, "partial");
  assert.equal(result.ratedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(service.calls.get("T2"), 2);
  assert.match(
    store.items.find((item) => item.company.symbol === "T2")?.lastError ?? "",
    /permanent failure/i,
  );
});

test("rating batch cancellation stops unclaimed work cleanly", async () => {
  const companies = Object.freeze([company(1), company(2), company(3)]);
  const store = new MemoryBatchStore(companies, 2);
  const service = new FakeService();
  const state = { value: Date.parse("2026-08-05T14:00:00.000Z") };
  await store.requestCancellation("1", new Date(state.value).toISOString());

  const result = await processor(store, service, state).run("1");

  assert.equal(result.status, "cancelled");
  assert.equal(result.cancelledCount, 3);
  assert.equal(result.claimedCount, 0);
  assert.equal(service.calls.size, 0);
});
