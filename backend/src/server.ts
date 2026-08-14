// TS: 2026-08-14 01:03 ET

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { refreshStalePilotOnStartup } from "./jobs/startup-pilot-refresh.js";
import { runSecUniverseBatchOnStartup } from "./jobs/startup-sec-universe-batch.js";
import { importUniverseOnStartup } from "./jobs/startup-universe-import.js";
import { ProviderNotConfiguredError } from "./providers/types.js";
import { buildFailClosedRatingResponse } from "./ratings/fail-closed-response.js";
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

  app.get("/api/startup-status", async () => getStartupStatusSnapshot());

  app.setErrorHandler((error, request, reply) => {
    if (request.url.startsWith("/api/ratings/")) {
      const symbol = request.url.split("?")[0]?.split("/").filter(Boolean).at(-1) ?? "UNKNOWN";
      const reason = error instanceof ProviderNotConfiguredError
        ? {
            code: "gate_marketQuote",
            message: "Current market-data evidence is not configured in the production rating service.",
          }
        : {
            code: "required_evidence_incomplete",
            message: "One or more required production evidence sources could not be retrieved.",
          };

      request.log.error({ error, symbol }, "Rating evidence retrieval failed closed");
      return reply.code(200).send(
        buildFailClosedRatingResponse(symbol, new Date().toISOString(), [reason]),
      );
    }

    const errorStatusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    const errorMessage = error instanceof Error ? error.message : "Request failed.";
    const statusCode =
      error instanceof ProviderNotConfiguredError
        ? 503
        : errorStatusCode !== null
          ? errorStatusCode
          : 500;

    request.log.error({ error, statusCode }, "API request failed");

    return reply.code(statusCode).send({
      error:
        error instanceof ProviderNotConfiguredError
          ? "provider_not_configured"
          : statusCode === 404
            ? "not_found"
            : "request_failed",
      message:
        statusCode >= 500 && !(error instanceof ProviderNotConfiguredError)
          ? "The data service could not complete the request."
          : errorMessage,
      timestamp: new Date().toISOString(),
    });
  });

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });

    void runStartupJobs(config, app);
  } catch (error) {
    app.log.error(error, "Next Year’s Monsters API failed to start");
    process.exitCode = 1;
  }
}

void start();
