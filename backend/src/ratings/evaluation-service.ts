// TS: 2026-08-09 18:48 ET

import {
  evaluateProductionRating,
  type ProductionRatingEvaluation,
} from "./evaluator.js";
import type { ProductionRatingAssemblySource } from "./production-input.js";
import type {
  RatingWriteStore,
  SavedRatingResult,
} from "./write-store.js";

export interface PersistedProductionRatingEvaluation {
  readonly evaluation: ProductionRatingEvaluation;
  readonly saved: SavedRatingResult;
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
