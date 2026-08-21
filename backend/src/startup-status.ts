// TS: 2026-08-21 17:08 UTC

export type StartupJobName = "universeImport" | "secUniverseBatch" | "pilotRefresh" | "ratingBatch";
export type StartupJobState = "pending" | "running" | "completed" | "failed";

export interface StartupJobSnapshot {
  readonly state: StartupJobState;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly summary: unknown;
  readonly error: string | null;
}

interface MutableStartupJobRecord {
  state: StartupJobState;
  startedAt: string | null;
  completedAt: string | null;
  summary: unknown;
  error: string | null;
}

const records: Record<StartupJobName, MutableStartupJobRecord> = {
  universeImport: {
    state: "pending",
    startedAt: null,
    completedAt: null,
    summary: null,
    error: null,
  },
  secUniverseBatch: {
    state: "pending",
    startedAt: null,
    completedAt: null,
    summary: null,
    error: null,
  },
  pilotRefresh: {
    state: "pending",
    startedAt: null,
    completedAt: null,
    summary: null,
    error: null,
  },
  ratingBatch: {
    state: "pending",
    startedAt: null,
    completedAt: null,
    summary: null,
    error: null,
  },
};

function now(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown startup failure.";
}

export function markStartupJobRunning(job: StartupJobName): void {
  records[job] = {
    state: "running",
    startedAt: now(),
    completedAt: null,
    summary: null,
    error: null,
  };
}

export function markStartupJobCompleted(job: StartupJobName, summary: unknown): void {
  const prior = records[job];
  records[job] = {
    state: "completed",
    startedAt: prior.startedAt ?? now(),
    completedAt: now(),
    summary,
    error: null,
  };
}

export function markStartupJobFailed(job: StartupJobName, error: unknown): void {
  const prior = records[job];
  records[job] = {
    state: "failed",
    startedAt: prior.startedAt ?? now(),
    completedAt: now(),
    summary: null,
    error: errorMessage(error),
  };
}

export function getStartupStatusSnapshot(): {
  readonly deploymentCommit: string | null;
  readonly generatedAt: string;
  readonly jobs: Readonly<Record<StartupJobName, StartupJobSnapshot>>;
} {
  const deploymentCommit = process.env.RENDER_GIT_COMMIT?.trim() || null;
  const jobs = Object.freeze({
    universeImport: Object.freeze({ ...records.universeImport }),
    secUniverseBatch: Object.freeze({ ...records.secUniverseBatch }),
    pilotRefresh: Object.freeze({ ...records.pilotRefresh }),
    ratingBatch: Object.freeze({ ...records.ratingBatch }),
  });

  return Object.freeze({
    deploymentCommit,
    generatedAt: now(),
    jobs,
  });
}

export function resetStartupStatusForTests(): void {
  for (const job of Object.keys(records) as StartupJobName[]) {
    records[job] = {
      state: "pending",
      startedAt: null,
      completedAt: null,
      summary: null,
      error: null,
    };
  }
}
