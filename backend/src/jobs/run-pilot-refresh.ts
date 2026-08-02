// TS: 2026-08-01 21:41 ET

import { loadConfig } from "../config.js";
import { createPersistenceStore } from "../database/persistence.js";
import { createMarketDataProvider } from "../providers/index.js";
import { createSecDataProvider } from "../sec/index.js";
import {
  PILOT_SYMBOLS,
  normalizeRefreshSymbols,
  refreshPilotSymbols,
} from "./pilot-refresh.js";

function requestedSymbols(arguments_: readonly string[]): readonly string[] {
  if (arguments_.length === 0) return Object.freeze(["AAPL"]);
  if (arguments_.length === 1 && arguments_[0]?.toLowerCase() === "--all") {
    return PILOT_SYMBOLS;
  }
  return normalizeRefreshSymbols(arguments_);
}

async function run(): Promise<void> {
  const config = loadConfig();
  const marketProvider = createMarketDataProvider(config);
  const secProvider = createSecDataProvider(config);
  const persistenceStore = createPersistenceStore(config);

  try {
    const symbols = requestedSymbols(process.argv.slice(2));
    const results = await refreshPilotSymbols(symbols, {
      marketProvider,
      secProvider,
      persistenceStore,
    });

    const summary = {
      requestedCount: symbols.length,
      completedCount: results.length,
      database: persistenceStore.name,
      marketProvider: marketProvider.name,
      secProvider: secProvider.name,
      results: results.map((result) => ({
        symbol: result.symbol,
        quoteStatus: result.quoteStatus,
        filingCount: result.filingCount,
        factCount: result.factCount,
        storedQuote: result.stored.latestQuote !== null,
        storedFiling: result.stored.latestFiling !== null,
        storedFactCount: result.stored.factCount,
        storedRatingCount: result.stored.ratingCount,
        completedAt: result.completedAt,
      })),
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await persistenceStore.close();
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown pilot refresh failure.";
  console.error(`Pilot refresh failed: ${message}`);
  process.exitCode = 1;
});
