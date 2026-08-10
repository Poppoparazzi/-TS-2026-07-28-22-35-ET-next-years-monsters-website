// TS: 2026-08-10 02:04 UTC

import {
  evaluatePersistAndVerifyProductionRating,
  type VerifiedPersistedProductionRatingEvaluation,
} from "./evaluation-service.js";
import type { ProductionRatingAssemblySource } from "./production-input.js";
import type { RatingReadStore } from "./read-store.js";
import type { RatingWriteStore } from "./write-store.js";

export interface SingleSymbolEvidenceLoader {
  readonly configured: boolean;
  load(symbol: string, calculatedAt: string): Promise<ProductionRatingAssemblySource>;
}

export interface SingleSymbolRatingDependencies {
  readonly evidenceLoader: SingleSymbolEvidenceLoader;
  readonly writeStore: RatingWriteStore;
  readonly readStore: RatingReadStore;
  readonly now?: () => Date;
}

function normalizeSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return symbol;
}

/**
 * Canonical one-ticker Current Stock Rating™ orchestration boundary.
 *
 * Provider adapters are responsible only for collecting explicit evidence.
 * They do not calculate or persist ratings. This orchestrator normalizes the
 * ticker, fixes one calculation timestamp for the entire run, loads evidence,
 * verifies the loaded identity, and then delegates to the fail-closed
 * evaluate/write/read-back path.
 */
export async function evaluateSingleSymbolProductionRating(
  rawSymbol: string,
  dependencies: SingleSymbolRatingDependencies,
): Promise<VerifiedPersistedProductionRatingEvaluation> {
  const symbol = normalizeSymbol(rawSymbol);

  if (!dependencies.evidenceLoader.configured) {
    throw new Error("Production rating evidence loader is not configured.");
  }
  if (!dependencies.writeStore.configured) {
    throw new Error("Production rating database is not configured.");
  }
  if (!dependencies.readStore.configured) {
    throw new Error("Production rating read database is not configured.");
  }

  const now = dependencies.now ?? (() => new Date());
  const calculatedAt = now().toISOString();
  const source = await dependencies.evidenceLoader.load(symbol, calculatedAt);
  const loadedSymbol = normalizeSymbol(source.symbol);

  if (loadedSymbol !== symbol) {
    throw new Error(
      `Production rating evidence identity mismatch: requested ${symbol}, received ${loadedSymbol}.`,
    );
  }
  if (source.calculatedAt !== calculatedAt) {
    throw new Error(
      `Production rating evidence timestamp mismatch for ${symbol}.`,
    );
  }

  return evaluatePersistAndVerifyProductionRating(
    Object.freeze({ ...source, symbol }),
    dependencies.writeStore,
    dependencies.readStore,
  );
}
