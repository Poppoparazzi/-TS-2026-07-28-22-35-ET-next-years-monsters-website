// TS: 2026-08-20 04:03 ET

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import {
  getBackfillPolicySnapshot,
  getDeploymentBranch,
  getDeploymentCommit,
  getDeploymentProvider,
  isServerlessRuntime,
} from "./deployment-policy.js";
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
