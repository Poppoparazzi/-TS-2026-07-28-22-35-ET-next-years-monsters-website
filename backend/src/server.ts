// TS: 2026-07-29 10:48 ET

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  try {
    await app.listen({
      host: config.host,
      port: config.port,
    });
  } catch (error) {
    app.log.error(error, "Next Year’s Monsters API failed to start");
    process.exitCode = 1;
  }
}

void start();
