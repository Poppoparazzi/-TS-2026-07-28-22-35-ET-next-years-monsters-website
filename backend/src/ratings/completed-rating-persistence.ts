// TS: 2026-09-13 14:58 UTC

export interface CompletedRatingPersistenceResult {
  readonly persisted: boolean;
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
    return Object.freeze({ persisted: true, attempts: 1, error: null });
  } catch (error) {
    firstError = error;
  }

  try {
    await persist();
    return Object.freeze({ persisted: true, attempts: 2, error: null });
  } catch (error) {
    return Object.freeze({
      persisted: false,
      attempts: 2,
      error: error ?? firstError,
    });
  }
}
