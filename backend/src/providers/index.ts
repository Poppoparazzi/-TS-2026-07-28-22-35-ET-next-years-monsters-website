// TS: 2026-09-07 09:14 ET

import type { AppConfig } from "../config.js";
import { PostgresBenchmarkHistoryCache } from "../database/benchmark-history-cache.js";
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
    return new TwelveDataMarketDataProvider(config.twelveDataApiKey, benchmarkHistoryCache);
  }

  return new UnconfiguredMarketDataProvider();
}
