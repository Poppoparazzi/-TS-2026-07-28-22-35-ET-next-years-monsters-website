// TS: 2026-08-09 18:48 ET

import {
  evaluateProductionRating,
  type ProductionRatingEvaluation,
} from "./evaluator.js";
import type { ProductionRatingAssemblySource } from "./production-input.js";
import type { RatingReadStore } from "./read-store.js";
import type { ProductionRatingResult } from "./types.js";
import type {
  RatingWriteStore,
  SavedRatingResult,
} from "./write-store.js";

export interface PersistedProductionRatingEvaluation {
  readonly evaluation: ProductionRatingEvaluation;
  readonly saved: SavedRatingResult;
}

export interface VerifiedPersistedProductionRatingEvaluation
  extends PersistedProductionRatingEvaluation {
  readonly publicResult: Readonly<Record<string, unknown>>;
}

/**
 * Canonical write-side entry point for Current Stock Rating™.
 *
 * Evidence is evaluated first through the fail-closed evaluator. The resulting
 * eligible or ineligible payload is then persisted transactionally by the
 * rating write store. Callers never bypass the evaluator to write a score.
 */
export async function evaluateAndPersistProductionRating(
  source: ProductionRatingAssemblySource,
  store: RatingWriteStore,
): Promise<PersistedProductionRatingEvaluation> {
  if (!store.configured) {
    throw new Error("Production rating database is not configured.");
  }

  const evaluation = evaluateProductionRating(source);
  const saved = await store.saveResult(evaluation.result);

  return Object.freeze({ evaluation, saved });
}

function assertPublicResultMatches(
  expected: ProductionRatingResult,
  actual: Readonly<Record<string, unknown>>,
): void {
  const fields = [
    "symbol",
    "eligible",
    "score",
    "tier",
    "engineVersion",
    "calculatedAt",
  ] as const;

  for (const field of fields) {
    if (!Object.is(actual[field], expected[field])) {
      throw new Error(
        `Persisted Current Stock Rating read-back mismatch for ${expected.symbol}: ${field}.`,
      );
    }
  }
}

/**
 * End-to-end persistence/read verification boundary.
 *
 * This extends the canonical evaluator/write service by reading the exact
 * symbol back through the same RatingReadStore used by the public API. A null
 * or mismatched payload is treated as an integrity failure rather than being
 * silently returned to Monster Check.
 */
export async function evaluatePersistAndVerifyProductionRating(
  source: ProductionRatingAssemblySource,
  writeStore: RatingWriteStore,
  readStore: RatingReadStore,
): Promise<VerifiedPersistedProductionRatingEvaluation> {
  if (!readStore.configured) {
    throw new Error("Production rating read database is not configured.");
  }

  const persisted = await evaluateAndPersistProductionRating(source, writeStore);
  const publicResult = await readStore.getCurrent(persisted.evaluation.result.symbol);

  if (!publicResult) {
    throw new Error(
      `Persisted Current Stock Rating for ${persisted.evaluation.result.symbol} was not readable.`,
    );
  }

  assertPublicResultMatches(persisted.evaluation.result, publicResult);

  return Object.freeze({
    ...persisted,
    publicResult: Object.freeze({ ...publicResult }),
  });
}
