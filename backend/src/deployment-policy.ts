// TS: 2026-08-20 04:02 ET

export type DeploymentProvider = "vercel" | "render" | "unknown";

export interface BackfillPolicySnapshot {
  readonly candidateTarget: number | null;
  readonly secBatchSize: number | null;
  readonly usableTarget: number | null;
  readonly concurrency: number | null;
  readonly maxAgeHours: number | null;
}

export function isServerlessRuntime(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(environment.VERCEL || environment.AWS_LAMBDA_FUNCTION_NAME);
}

export function getDeploymentProvider(
  environment: NodeJS.ProcessEnv = process.env,
): DeploymentProvider {
  if (environment.VERCEL) return "vercel";
  if (environment.RENDER) return "render";
  return "unknown";
}

export function getDeploymentCommit(
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  return environment.VERCEL_GIT_COMMIT_SHA ?? environment.RENDER_GIT_COMMIT ?? null;
}

export function getDeploymentBranch(
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  return environment.VERCEL_GIT_COMMIT_REF ?? environment.RENDER_GIT_BRANCH ?? null;
}

function safeEnvironmentInteger(
  environment: NodeJS.ProcessEnv,
  key: string,
): number | null {
  const raw = environment[key]?.trim();
  if (!raw) return null;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function getBackfillPolicySnapshot(
  nodeEnv: string,
  environment: NodeJS.ProcessEnv = process.env,
): Readonly<BackfillPolicySnapshot> {
  // Report the policy the persistent production worker will actually use, not only
  // the raw Blueprint values. Serverless runtimes intentionally do not inherit
  // these production-worker fallbacks because startup backfill jobs are disabled.
  const useProductionFallbacks = nodeEnv === "production" && !isServerlessRuntime(environment);

  return Object.freeze({
    candidateTarget:
      safeEnvironmentInteger(environment, "AUTO_IMPORT_UNIVERSE_LIMIT") ??
      (useProductionFallbacks ? 5_000 : null),
    secBatchSize:
      safeEnvironmentInteger(environment, "AUTO_SEC_BATCH_SIZE") ??
      (useProductionFallbacks ? 5_000 : null),
    usableTarget:
      safeEnvironmentInteger(environment, "SEC_USABLE_TARGET") ??
      (useProductionFallbacks ? 2_200 : null),
    concurrency:
      safeEnvironmentInteger(environment, "SEC_BATCH_CONCURRENCY") ??
      (useProductionFallbacks ? 8 : null),
    maxAgeHours:
      safeEnvironmentInteger(environment, "SEC_BATCH_MAX_AGE_HOURS") ??
      (useProductionFallbacks ? 720 : null),
  });
}
