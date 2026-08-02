// TS: 2026-08-02 13:55 ET

import type { AppConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createSecDataProvider } from "../sec/index.js";
import { PILOT_SYMBOLS, refreshPilotSymbols } from "./pilot-refresh.js";

const DEFAULT_MAX_AGE_HOURS = 24;

export type StartupPilotRefreshStatus =
  | "disabled"
  | "dependencies-unconfigured"
  | "already-fresh"
  | "refreshed";

export interface StartupPilotRefreshSummary {
  readonly status: StartupPilotRefreshStatus;
  readonly checkedCount: number;
  readonly staleCount: number;
  readonly refreshedCount: number;
  readonly refreshedSymbols: readonly string[];
  readonly database: string;
  readonly secProvider: string;
  readonly marketProvider: string;
  readonly completedAt: string;
  readonly detail: string;
}

function enabled(environment: NodeJS.ProcessEnv): boolean {
  return (environment.AUTO_REFRESH_PILOT_ON_START ?? "")
    .trim()
    .toLowerCase() === "true";
}

function maxAgeHours(environment: NodeJS.ProcessEnv): number {
  const parsed = Number(environment.PILOT_REFRESH_MAX_AGE_HOURS ?? DEFAULT_MAX_AGE_HOURS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_AGE_HOURS;
}

function isStale(updatedAt: string | null | undefined, now: number, maximumAgeMs: number): boolean {
  if (!updatedAt) return true;
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return true;
  return now - timestamp >= maximumAgeMs;
}

export async function refreshStalePilotOnStartup(
  config: AppConfig,
  environment: NodeJS.ProcessEnv = process.env,
  now = Date.now(),
): Promise<StartupPilotRefreshSummary> {
  const marketProvider = createMarketDataProvider(config);
  const secProvider = createSecDataProvider(config);
  const persistenceStore = createPersistenceStore(config);

  const base = {
    checkedCount: PILOT_SYMBOLS.length,
    database: persistenceStore.name,
    secProvider: secProvider.name,
    marketProvider: marketProvider.name,
  };

  try {
    if (!enabled(environment)) {
      return Object.freeze({
        ...base,
        status: "disabled" as const,
        staleCount: 0,
        refreshedCount: 0,
        refreshedSymbols: Object.freeze([]),
        completedAt: new Date(now).toISOString(),
        detail: "Automatic pilot refresh is disabled.",
      });
    }

    if (!persistenceStore.configured || !secProvider.configured) {
      return Object.freeze({
        ...base,
        status: "dependencies-unconfigured" as const,
        staleCount: 0,
        refreshedCount: 0,
        refreshedSymbols: Object.freeze([]),
        completedAt: new Date(now).toISOString(),
        detail: "Automatic pilot refresh requires both the production database and official SEC provider.",
      });
    }

    const maximumAgeMs = maxAgeHours(environment) * 60 * 60 * 1000;
    const staleSymbols: string[] = [];

    for (const symbol of PILOT_SYMBOLS) {
      const stored = await persistenceStore.getStoredCompany(symbol);
      if (!stored || isStale(stored.updatedAt, now, maximumAgeMs)) {
        staleSymbols.push(symbol);
      }
    }

    if (staleSymbols.length === 0) {
      return Object.freeze({
        ...base,
        status: "already-fresh" as const,
        staleCount: 0,
        refreshedCount: 0,
        refreshedSymbols: Object.freeze([]),
        completedAt: new Date().toISOString(),
        detail: `All ${PILOT_SYMBOLS.length} pilot records are newer than ${maxAgeHours(environment)} hours.`,
      });
    }

    const results = await refreshPilotSymbols(staleSymbols, {
      marketProvider,
      secProvider,
      persistenceStore,
    });

    return Object.freeze({
      ...base,
      status: "refreshed" as const,
      staleCount: staleSymbols.length,
      refreshedCount: results.length,
      refreshedSymbols: Object.freeze(results.map((result) => result.symbol)),
      completedAt: new Date().toISOString(),
      detail: marketProvider.configured
        ? "Stale pilot SEC evidence and available quote snapshots were refreshed."
        : "Stale pilot SEC evidence was refreshed; quote snapshots remain unconfigured.",
    });
  } finally {
    await persistenceStore.close();
  }
}
