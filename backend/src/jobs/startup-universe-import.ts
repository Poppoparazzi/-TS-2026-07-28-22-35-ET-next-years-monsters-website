// TS: 2026-08-21 15:47 UTC

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

export function configuredUniverseImportLimit(
  environment: NodeJS.ProcessEnv,
  productionFallback = 0,
): number {
  const raw = environment.AUTO_IMPORT_UNIVERSE_LIMIT?.trim();
  if (!raw) return productionFallback;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 5_000) {
    throw new Error("AUTO_IMPORT_UNIVERSE_LIMIT must be an integer from 0 to 5000.");
  }

  return productionFallback > 0
    ? Math.max(value, productionFallback)
    : value;
}

export async function importUniverseOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<StartupUniverseImportSummary> {
  // Production recovery must not silently fall back to a disabled universe import
  // merely because Render's service environment drifts from render.yaml. Local/test
  // environments still default to disabled unless they explicitly opt in.
  const requestedLimit = configuredUniverseImportLimit(
    environment,
    config.nodeEnv === "production" ? 5_000 : 0,
  );
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
