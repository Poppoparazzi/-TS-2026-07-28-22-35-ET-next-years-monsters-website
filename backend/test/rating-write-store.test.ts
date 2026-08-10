// TS: 2026-08-09 18:48 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  persistRatingResult,
  type RatingWriteClient,
  type RatingWritePool,
} from "../src/ratings/write-store.js";
import type { ProductionRatingResult } from "../src/ratings/types.js";

const unratedResult: ProductionRatingResult = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  engineVersion: "nym-rating-v1.0.0",
  calculatedAt: "2026-08-09T22:48:00.000Z",
  dataAsOf: null,
  dataCompletenessScore: 0,
  evidenceInputs: [],
  eligible: false,
  eligibilityCode: "incomplete_evidence",
  score: null,
  tier: null,
  confidence: "unavailable",
  components: [],
  reasons: [{
    code: "incomplete_evidence",
    message: "Required verified evidence is incomplete.",
    retryable: true,
    missingEvidence: ["licensed market-data provider"],
  }],
  summary: "Not Yet Rated",
};

const ratedResult: ProductionRatingResult = {
  symbol: "AAPL",
  companyName: "Apple Inc.",
  engineVersion: "nym-rating-v1.0.0",
  calculatedAt: "2026-08-09T22:48:00.000Z",
  dataAsOf: "2026-08-09T20:00:00.000Z",
  dataCompletenessScore: 100,
  evidenceInputs: [],
  eligible: true,
  eligibilityCode: "eligible",
  score: 88,
  tier: "Gold",
  confidence: "high",
  components: [],
  positiveDrivers: ["verified growth evidence"],
  negativeDrivers: [],
  summary: "Verified rating result",
  risks: "No unsupported risk claims.",
};

class RecordingClient implements RatingWriteClient {
  public readonly statements: string[] = [];
  public released = false;
  public missingCompany = false;

  public async query<Row = Record<string, unknown>>(
    text: string,
    _values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Row[] }> {
    this.statements.push(text.trim());
    if (text.includes("SELECT id FROM companies")) {
      const rows = this.missingCompany ? [] : [{ id: 7 }];
      return { rows: rows as unknown as readonly Row[] };
    }
    if (text.includes("INSERT INTO rating_eligibility_results")) {
      return { rows: [{ id: 101 }] as unknown as readonly Row[] };
    }
    if (text.includes("SELECT id, score") && text.includes("monster_rating_runs")) {
      return { rows: [] as readonly Row[] };
    }
    if (text.includes("INSERT INTO monster_rating_runs")) {
      return { rows: [{ id: 202 }] as unknown as readonly Row[] };
    }
    return { rows: [] as readonly Row[] };
  }

  public release(): void {
    this.released = true;
  }
}

class RecordingPool implements RatingWritePool {
  public readonly client = new RecordingClient();

  public async connect(): Promise<RatingWriteClient> {
    return this.client;
  }

  public async end(): Promise<void> {}
}

test("unrated evaluation is persisted transactionally in eligibility results", async () => {
  const pool = new RecordingPool();
  const saved = await persistRatingResult(pool, unratedResult);

  assert.deepEqual(saved, { ratingRunId: null, eligibilityResultId: "101" });
  assert.equal(pool.client.statements[0], "BEGIN");
  assert.ok(pool.client.statements.some((sql) => sql.includes("INSERT INTO rating_eligibility_results")));
  assert.ok(!pool.client.statements.some((sql) => sql.includes("INSERT INTO monster_rating_runs")));
  assert.equal(pool.client.statements.at(-1), "COMMIT");
  assert.equal(pool.client.released, true);
});

test("eligible evaluation is persisted transactionally as a completed rating run", async () => {
  const pool = new RecordingPool();
  const saved = await persistRatingResult(pool, ratedResult);

  assert.deepEqual(saved, { ratingRunId: "202", eligibilityResultId: null });
  assert.ok(pool.client.statements.some((sql) => sql.includes("INSERT INTO monster_rating_runs")));
  assert.ok(!pool.client.statements.some((sql) => sql.includes("INSERT INTO rating_eligibility_results")));
  assert.equal(pool.client.statements.at(-1), "COMMIT");
  assert.equal(pool.client.released, true);
});

test("missing coverage company rolls back instead of leaving a partial write", async () => {
  const pool = new RecordingPool();
  pool.client.missingCompany = true;

  await assert.rejects(
    persistRatingResult(pool, unratedResult),
    /Active coverage company AAPL was not found/,
  );

  assert.equal(pool.client.statements[0], "BEGIN");
  assert.equal(pool.client.statements.at(-1), "ROLLBACK");
  assert.equal(pool.client.released, true);
});
