// TS: 2026-09-13 16:57 UTC

export type CompletedRatingPersistenceState =
  | "persisted"
  | "completed_rating_persistence_pending";

export interface CompletedRatingPersistenceResult {
  readonly persisted: boolean;
  readonly state: CompletedRatingPersistenceState;
  readonly attempts: number;
  readonly error: unknown | null;
}

/**
 * Retry completed-rating persistence from already-computed evidence only.
 *
 * This helper intentionally knows nothing about market-data providers. Callers
 * must pass a closure that only writes the already-computed rating/evidence so
 * a storage retry can never trigger another paid history fetch.
 */
export async function persistCompletedRatingWithSingleRetry(
  persist: () => Promise<void>,
): Promise<CompletedRatingPersistenceResult> {
  let firstError: unknown = null;

  try {
    await persist();
    return Object.freeze({
      persisted: true,
      state: "persisted",
      attempts: 1,
      error: null,
    });
  } catch (error) {
    firstError = error;
  }

  try {
    await persist();
    return Object.freeze({
      persisted: true,
      state: "persisted",
      attempts: 2,
      error: null,
    });
  } catch (error) {
    return Object.freeze({
      persisted: false,
      state: "completed_rating_persistence_pending",
      attempts: 2,
      error: error ?? firstError,
    });
  }
}
