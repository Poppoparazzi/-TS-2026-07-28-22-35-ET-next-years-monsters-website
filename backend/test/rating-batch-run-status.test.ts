// TS: 2026-08-25 18:20 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepositoryFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("provider-wide rating stoppages remain partial instead of false failed runs", () => {
  const batchStoreSource = readRepositoryFile("../src/ratings/batch-store.ts");

  assert.match(
    batchStoreSource,
    /function stoppedByBatchLevelInfrastructure\(accounting: RatingBatchAccounting\): boolean/,
    "batch-store must keep a dedicated infrastructure-stop classifier",
  );
  assert.match(
    batchStoreSource,
    /\^\(Benchmark market history\|Market-data provider\|Upstream transport\)/i,
    "benchmark, provider, and transport outages must remain batch-level conditions",
  );
  assert.match(
    batchStoreSource,
    /stoppedByBatchLevelInfrastructure\(accounting\)[\s\S]*?\? "partial"[\s\S]*?: "failed"/,
    "zero-rating infrastructure stoppages must be stored as partial, not failed",
  );
});

test("normal candidate exhaustion is partial rather than a false failed run", () => {
  const batchStoreSource = readRepositoryFile("../src/ratings/batch-store.ts");

  assert.match(
    batchStoreSource,
    /function completedNormalCandidatePass\(accounting: RatingBatchAccounting\): boolean/,
    "batch-store must distinguish a normal pass from an execution failure",
  );
  assert.match(
    batchStoreSource,
    /return accounting\.stoppedReason === null;/,
    "a normal pass must remain normal even when cumulative exclusions leave zero candidates",
  );
  assert.match(
    batchStoreSource,
    /completedNormalCandidatePass\(accounting\)[\s\S]*?\? "partial"[\s\S]*?: "failed"/,
    "a normal zero-rating pass must be partial, not failed",
  );
});
