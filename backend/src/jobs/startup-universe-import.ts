// TS: 2026-08-02 14:34 ET

import type { AppConfig } from "../config.js";
import { loadSecUniverse } from "../universe/sec-source.js";
import { createUniverseStore } from "../universe/store.js";

export interface StartupUniverseImportSummary {
  readonly status: "disabled" | "skipped" | "completed";
  readonly requestedLimit: number;
  readonly importedCount: number;
  readonly universeSize: number;
  readonly reason: string | null;
  readonly completedAt: string;
}

function configuredLimit(environment: NodeJS.ProcessEnv): number {
  const raw = environment.AUTO_IMPORT_UNIVERSE_LIMIT?.trim();
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 5_000) {
    throw new Error("AUTO_IMPORT_UNIVERSE_LIMIT must be an integer from 0 to 5000.");
  }

  return value;
}

export async function importUniverseOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<StartupUniverseImportSummary> {
  const requestedLimit = configuredLimit(environment);
  const completedAt = () => new Date().toISOString();

  if (requestedLimit === 0) {
    return Object.freeze({
      status: "disabled",
      requestedLimit,
      importedCount: 0,
      universeSize: 0,
      reason: "Automatic universe import is disabled.",
      completedAt: completedAt(),
    });
  }

  if (!config.secUserAgent || !config.databaseUrl) {
    return Object.freeze({
      status: "skipped",
      requestedLimit,
      importedCount: 0,
      universeSize: 0,
      reason: "SEC_USER_AGENT and DATABASE_URL are required for automatic universe import.",
      completedAt: completedAt(),
    });
  }

  const store = createUniverseStore(config);

  try {
    const companies = await loadSecUniverse(config.secUserAgent, requestedLimit);
    const imported = await store.importCompanies(companies);
    const status = await store.getStatus(requestedLimit);

    return Object.freeze({
      status: "completed",
      requestedLimit,
      importedCount: imported.importedCount,
      universeSize: status.universeSize,
      reason: null,
      completedAt: completedAt(),
    });
  } finally {
    await store.close();
  }
}
