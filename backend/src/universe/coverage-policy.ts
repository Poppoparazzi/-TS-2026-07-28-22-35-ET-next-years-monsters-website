// TS: 2026-08-21 15:16 UTC

export const ACTIVE_SEC_TARGET = 2_200;
export const CANDIDATE_POOL_TARGET = 5_000;

export interface CoverageSnapshot {
  readonly universeSize: number;
  readonly candidatesExaminedCount: number;
  readonly secEvidenceReadyCount: number;
  readonly protectedMustRepairCount: number;
  readonly replaceableFailureCount: number;
}

export interface CoverageDecision {
  readonly activeSecTarget: number;
  readonly candidatePoolTarget: number;
  readonly targetSatisfied: boolean;
  readonly usableShortfall: number;
  readonly reserveCandidateCount: number;
  readonly substitutionEligibleCount: number;
  readonly replacementsAttemptedCount: number;
  readonly finalUsableUniverseCount: number;
}

function nonnegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(Math.trunc(value), 0);
}

export function evaluateCoverage(snapshot: CoverageSnapshot): CoverageDecision {
  const universeSize = nonnegativeInteger(snapshot.universeSize);
  const candidatesExaminedCount = nonnegativeInteger(snapshot.candidatesExaminedCount);
  const secEvidenceReadyCount = nonnegativeInteger(snapshot.secEvidenceReadyCount);
  const protectedMustRepairCount = nonnegativeInteger(snapshot.protectedMustRepairCount);
  const replaceableFailureCount = nonnegativeInteger(snapshot.replaceableFailureCount);

  return Object.freeze({
    activeSecTarget: ACTIVE_SEC_TARGET,
    candidatePoolTarget: CANDIDATE_POOL_TARGET,
    targetSatisfied:
      secEvidenceReadyCount >= ACTIVE_SEC_TARGET && protectedMustRepairCount === 0,
    usableShortfall: Math.max(ACTIVE_SEC_TARGET - secEvidenceReadyCount, 0),
    reserveCandidateCount: Math.max(universeSize - candidatesExaminedCount, 0),
    substitutionEligibleCount: replaceableFailureCount,
    replacementsAttemptedCount: Math.min(
      replaceableFailureCount,
      Math.max(candidatesExaminedCount - ACTIVE_SEC_TARGET, 0),
    ),
    finalUsableUniverseCount: secEvidenceReadyCount,
  });
}
