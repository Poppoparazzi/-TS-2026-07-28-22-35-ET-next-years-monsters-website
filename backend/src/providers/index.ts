// TS: 2026-07-29 10:45 ET

import type { AppConfig } from "../config.js";
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

    return new TwelveDataMarketDataProvider(config.twelveDataApiKey);
  }

  return new UnconfiguredMarketDataProvider();
}
