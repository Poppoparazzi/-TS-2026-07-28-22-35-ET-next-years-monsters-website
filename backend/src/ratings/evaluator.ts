// TS: 2026-08-09 18:05 ET

import { calculateProductionMonsterRating } from "./engine.js";
import {
  assembleProductionRatingInput,
  type ProductionRatingAssemblySource,
} from "./production-input.js";
import { MONSTER_RATING_ENGINE_VERSION } from "./spec-v1.js";
import type { IneligibleProductionRating, ProductionRatingResult } from "./types.js";

export interface ProductionRatingEvaluationFailure {
  readonly ready: false;
  readonly result: IneligibleProductionRating;
}

export interface ProductionRatingEvaluationSuccess {
  readonly ready: true;
  readonly result: ProductionRatingResult;
}

export type ProductionRatingEvaluation =
  | ProductionRatingEvaluationFailure
  | ProductionRatingEvaluationSuccess;

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function unavailableResult(
  source: ProductionRatingAssemblySource,
  missingEvidence: readonly string[],
): IneligibleProductionRating {
  return Object.freeze({
    symbol: normalizeSymbol(source.symbol),
    companyName: source.companyName.trim(),
    engineVersion: MONSTER_RATING_ENGINE_VERSION,
    calculatedAt: source.calculatedAt,
    dataAsOf: null,
    dataCompletenessScore: 0,
    evidenceInputs: Object.freeze([]),
    eligible: false,
    eligibilityCode: "incomplete_evidence",
    score: null,
    tier: null,
    confidence: "unavailable",
    components: Object.freeze([]),
    reasons: Object.freeze([
      Object.freeze({
        code: "incomplete_evidence",
        message: "Required verified evidence is incomplete, so no Current Stock Rating™ was calculated.",
        retryable: true,
        missingEvidence: Object.freeze([...missingEvidence]),
      }),
    ]),
    summary: "Not Yet Rated",
  });
}

/**
 * Single fail-closed entry point for Current Stock Rating™ evaluation.
 * The calculation engine is unreachable until the evidence assembler returns ready=true.
 */
export function evaluateProductionRating(
  source: ProductionRatingAssemblySource,
): ProductionRatingEvaluation {
  const assembled = assembleProductionRatingInput(source);

  if (!assembled.ready) {
    return Object.freeze({
      ready: false,
      result: unavailableResult(source, assembled.missingEvidence),
    });
  }

  return Object.freeze({
    ready: true,
    result: calculateProductionMonsterRating(assembled.input),
  });
}
