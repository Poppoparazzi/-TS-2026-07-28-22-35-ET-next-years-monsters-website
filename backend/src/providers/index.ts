// TS: 2026-09-09 08:02 ET

import type { AppConfig } from "../config.js";
import {
  BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS,
  PostgresBenchmarkHistoryCache,
} from "../database/benchmark-history-cache.js";
import type { MarketDataProvider } from "./types.js";
import { TwelveDataMarketDataProvider } from "./twelve-data.js";
import { UnconfiguredMarketDataProvider } from "./unconfigured.js";

export function createMarketDataProvider(config: AppConfig): MarketDataProvider {
  if (config.marketDataProvider === "twelve-data") {
    if (!config.twelveDataApiKey) {
      throw new Error(
        "MARKET_DATA_PROVIDER is twelve-data, but TWELVE_DATA_API_KEY is missing.",
      );
    }

    const benchmarkHistoryCache = config.databaseUrl
      ? new PostgresBenchmarkHistoryCache(config.databaseUrl)
      : undefined;
    const provider = new TwelveDataMarketDataProvider(config.twelveDataApiKey, benchmarkHistoryCache);

    return Object.assign(provider, {
      getCachedDailyHistory: async (symbol: string, outputSize = 260) => {
        if (!benchmarkHistoryCache) return null;
        const safeOutputSize = Math.min(Math.max(Math.trunc(outputSize), 60), 500);
        return benchmarkHistoryCache.getFresh(
          symbol,
          provider.name,
          safeOutputSize,
          BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS,
        );
      },
    });
  }

  return new UnconfiguredMarketDataProvider();
}
