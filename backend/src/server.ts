// TS: 2026-08-02 13:55 ET

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { refreshStalePilotOnStartup } from "./jobs/startup-pilot-refresh.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });

    void refreshStalePilotOnStartup(config)
      .then((summary) => {
        app.log.info({ pilotRefresh: summary }, "Startup pilot refresh completed");
      })
      .catch((error: unknown) => {
        app.log.error(
          { error },
          "Startup pilot refresh failed without stopping the public API",
        );
      });
  } catch (error) {
    app.log.error(error, "Next Year’s Monsters API failed to start");
    process.exitCode = 1;
  }
}

void start();
