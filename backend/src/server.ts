// TS: 2026-08-20 02:58 ET

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { refreshStalePilotOnStartup } from "./jobs/startup-pilot-refresh.js";
import { runSecUniverseBatchOnStartup } from "./jobs/startup-sec-universe-batch.js";
import { importUniverseOnStartup } from "./jobs/startup-universe-import.js";
import { installFailClosedRatingErrorHandler } from "./ratings/install-fail-closed-handler.js";
import {
  getStartupStatusSnapshot,
  markStartupJobCompleted,
  markStartupJobFailed,
  markStartupJobRunning,
} from "./startup-status.js";

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function getDeploymentProvider(): "vercel" | "render" | "unknown" {
  if (process.env.VERCEL) {
    return "vercel";
  }
  if (process.env.RENDER) {
    return "render";
  }
  return "unknown";
}

function getDeploymentCommit(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT ?? null;
}

function getDeploymentBranch(): string | null {
  return process.env.VERCEL_GIT_COMMIT_REF ?? process.env.RENDER_GIT_BRANCH ?? null;
}

function safeEnvironmentInteger(key: string): number | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;

  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function getBackfillPolicySnapshot(nodeEnv: string) {
  // Report the policy the persistent production worker will actually use, not only
  // the raw Blueprint values. The startup jobs intentionally fall back to these
  // settings when Render loses an environment value, so observability must mirror
  // execution or the production smoke can misdiagnose a healthy recovery.
  const useProductionFallbacks = nodeEnv === "production" && !isServerlessRuntime();

  return Object.freeze({
    candidateTarget:
      safeEnvironmentInteger("AUTO_IMPORT_UNIVERSE_LIMIT") ??
      (useProductionFallbacks ? 5_000 : null),
    secBatchSize:
      safeEnvironmentInteger("AUTO_SEC_BATCH_SIZE") ??
      (useProductionFallbacks ? 5_000 : null),
    usableTarget:
      safeEnvironmentInteger("SEC_USABLE_TARGET") ??
      (useProductionFallbacks ? 2_200 : null),
    concurrency:
      safeEnvironmentInteger("SEC_BATCH_CONCURRENCY") ??
      (useProductionFallbacks ? 8 : null),
    maxAgeHours:
      safeEnvironmentInteger("SEC_BATCH_MAX_AGE_HOURS") ??
      (useProductionFallbacks ? 720 : null),
  });
}

async function runStartupJobs(
  config: ReturnType<typeof loadConfig>,
  app: Awaited<ReturnType<typeof buildApp>>,
): Promise<void> {
  markStartupJobRunning("universeImport");
  try {
    const universeSummary = await importUniverseOnStartup(config);
    markStartupJobCompleted("universeImport", universeSummary);
    app.log.info({ universeImport: universeSummary }, "Startup universe import completed");
  } catch (error: unknown) {
    markStartupJobFailed("universeImport", error);
    app.log.error(
      { error },
      "Startup universe import failed without stopping the public API",
    );
  }

  markStartupJobRunning("secUniverseBatch");
  try {
    const batchSummary = await runSecUniverseBatchOnStartup(config);
    markStartupJobCompleted("secUniverseBatch", batchSummary);
    app.log.info({ secUniverseBatch: batchSummary }, "Startup SEC universe batch completed");
  } catch (error: unknown) {
    markStartupJobFailed("secUniverseBatch", error);
    app.log.error(
      { error },
      "Startup SEC universe batch failed without stopping the public API",
    );
  }

  markStartupJobRunning("pilotRefresh");
  try {
    const pilotSummary = await refreshStalePilotOnStartup(config);
    markStartupJobCompleted("pilotRefresh", pilotSummary);
    app.log.info({ pilotRefresh: pilotSummary }, "Startup pilot refresh completed");
  } catch (error: unknown) {
    markStartupJobFailed("pilotRefresh", error);
    app.log.error(
      { error },
      "Startup pilot refresh failed without stopping the public API",
    );
  }
}

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  app.get("/api/startup-status", async () => ({
    ...getStartupStatusSnapshot(),
    runtime: isServerlessRuntime() ? "serverless" : "persistent-server",
    startupJobsEnabled: !isServerlessRuntime(),
    deployment: {
      provider: getDeploymentProvider(),
      commit: getDeploymentCommit(),
      branch: getDeploymentBranch(),
    },
    backfillPolicy: getBackfillPolicySnapshot(config.nodeEnv),
  }));
  installFailClosedRatingErrorHandler(app);

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });

    if (isServerlessRuntime()) {
      app.log.info(
        "Serverless runtime detected; startup universe, SEC batch, and pilot refresh jobs are disabled",
      );
    } else {
      void runStartupJobs(config, app);
    }
  } catch (error) {
    app.log.error(error, "Next Year’s Monsters API failed to start");
    process.exitCode = 1;
  }
}

void start();
