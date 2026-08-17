// TS: 2026-08-17 09:01 ET

export const ACTIVE_SEC_TARGET = 2_000;
export const CANDIDATE_POOL_TARGET = 2_500;

export interface CoverageSnapshot {
  readonly universeSize: number;
  readonly secCompleteCount: number;
  readonly unresolvedCount: number;
  readonly failedCount: number;
}

export interface CoverageDecision {
  readonly activeSecTarget: number;
  readonly candidatePoolTarget: number;
  readonly targetSatisfied: boolean;
  readonly usableShortfall: number;
  readonly reserveCandidateCount: number;
  readonly substitutionEligibleCount: number;
}

function nonnegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(Math.trunc(value), 0);
}

export function evaluateCoverage(snapshot: CoverageSnapshot): CoverageDecision {
  const universeSize = nonnegativeInteger(snapshot.universeSize);
  const secCompleteCount = nonnegativeInteger(snapshot.secCompleteCount);
  const unresolvedCount = nonnegativeInteger(snapshot.unresolvedCount);
  const failedCount = nonnegativeInteger(snapshot.failedCount);

  return Object.freeze({
    activeSecTarget: ACTIVE_SEC_TARGET,
    candidatePoolTarget: CANDIDATE_POOL_TARGET,
    targetSatisfied: secCompleteCount >= ACTIVE_SEC_TARGET,
    usableShortfall: Math.max(ACTIVE_SEC_TARGET - secCompleteCount, 0),
    reserveCandidateCount: Math.max(universeSize - ACTIVE_SEC_TARGET, 0),
    substitutionEligibleCount: unresolvedCount + failedCount,
  });
}
