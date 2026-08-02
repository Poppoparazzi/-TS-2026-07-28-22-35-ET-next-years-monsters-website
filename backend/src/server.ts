// TS: 2026-08-02 14:35 ET

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { refreshStalePilotOnStartup } from "./jobs/startup-pilot-refresh.js";
import { importUniverseOnStartup } from "./jobs/startup-universe-import.js";

async function runStartupJobs(config: ReturnType<typeof loadConfig>, app: Awaited<ReturnType<typeof buildApp>>): Promise<void> {
  try {
    const universeSummary = await importUniverseOnStartup(config);
    app.log.info({ universeImport: universeSummary }, "Startup universe import completed");
  } catch (error: unknown) {
    app.log.error(
      { error },
      "Startup universe import failed without stopping the public API",
    );
  }

  try {
    const pilotSummary = await refreshStalePilotOnStartup(config);
    app.log.info({ pilotRefresh: pilotSummary }, "Startup pilot refresh completed");
  } catch (error: unknown) {
    app.log.error(
      { error },
      "Startup pilot refresh failed without stopping the public API",
    );
  }
}

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

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
