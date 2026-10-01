// TS: 2026-10-01 07:20 ET

export const MONSTER_DNA_V2_POLICY_VERSION = "monster-dna-v2.0-prospective";

export interface MonsterDnaV2Pillars {
  readonly businessDna: number;
  readonly inflectionExpectations: number;
  readonly marketConfirmation: number;
}

export interface MonsterDnaV2Readiness {
  readonly earningsGuidanceCurrent: boolean;
  readonly valuationExpectationsCurrent: boolean;
  readonly marketEvidenceCurrent: boolean;
  readonly unresolvedCriticalEvidenceConflict: boolean;
}

export interface MonsterDnaV2Input {
  readonly pillars: MonsterDnaV2Pillars;
  readonly antiDnaPenalty: number;
  readonly readiness: MonsterDnaV2Readiness;
}

export type MonsterDnaV2Gate =
  | "adjusted_score"
  | "business_dna"
  | "inflection_expectations"
  | "market_confirmation"
  | "anti_dna_penalty"
  | "earnings_guidance_freshness"
  | "valuation_expectations_freshness"
  | "market_evidence_freshness"
  | "critical_evidence_conflict";

export interface MonsterDnaV2Evaluation {
  readonly policyVersion: typeof MONSTER_DNA_V2_POLICY_VERSION;
  readonly adjustedScore: number;
  readonly activeCandidate: boolean;
  readonly failedGates: readonly MonsterDnaV2Gate[];
}

const ACTIVE_SCORE_MIN = 80;
const BUSINESS_DNA_MIN = 70;
const INFLECTION_EXPECTATIONS_MIN = 65;
const MARKET_CONFIRMATION_MIN = 55;
const ANTI_DNA_PENALTY_MAX = 15;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 100);
}

function round(value: number, digits = 1): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

export function evaluateMonsterDnaV2(input: MonsterDnaV2Input): MonsterDnaV2Evaluation {
  const businessDna = finiteScore(input.pillars.businessDna);
  const inflectionExpectations = finiteScore(input.pillars.inflectionExpectations);
  const marketConfirmation = finiteScore(input.pillars.marketConfirmation);
  const antiDnaPenalty = clamp(
    Number.isFinite(input.antiDnaPenalty) ? input.antiDnaPenalty : 30,
    0,
    30,
  );

  const adjustedScore = round(clamp(
    businessDna * 0.40 +
    inflectionExpectations * 0.35 +
    marketConfirmation * 0.25 -
    antiDnaPenalty,
    0,
    100,
  ));

  const failedGates: MonsterDnaV2Gate[] = [];
  if (adjustedScore < ACTIVE_SCORE_MIN) failedGates.push("adjusted_score");
  if (businessDna < BUSINESS_DNA_MIN) failedGates.push("business_dna");
  if (inflectionExpectations < INFLECTION_EXPECTATIONS_MIN) failedGates.push("inflection_expectations");
  if (marketConfirmation < MARKET_CONFIRMATION_MIN) failedGates.push("market_confirmation");
  if (antiDnaPenalty > ANTI_DNA_PENALTY_MAX) failedGates.push("anti_dna_penalty");
  if (!input.readiness.earningsGuidanceCurrent) failedGates.push("earnings_guidance_freshness");
  if (!input.readiness.valuationExpectationsCurrent) failedGates.push("valuation_expectations_freshness");
  if (!input.readiness.marketEvidenceCurrent) failedGates.push("market_evidence_freshness");
  if (input.readiness.unresolvedCriticalEvidenceConflict) failedGates.push("critical_evidence_conflict");

  return Object.freeze({
    policyVersion: MONSTER_DNA_V2_POLICY_VERSION,
    adjustedScore,
    activeCandidate: failedGates.length === 0,
    failedGates: Object.freeze(failedGates),
  });
}
