// TS: 2026-09-09 11:00 ET

import type { AppConfig } from "../config.js";
import {
  BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS,
  PostgresBenchmarkHistoryCache,
} from "../database/benchmark-history-cache.js";
import type { DailyMarketHistory, MarketDataProvider } from "./types.js";
import { TwelveDataMarketDataProvider } from "./twelve-data.js";
import { UnconfiguredMarketDataProvider } from "./unconfigured.js";

function normalizedHistorySymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function assertMarketHistoryIdentity(
  history: DailyMarketHistory,
  requestedSymbol: string,
  providerName: string,
): DailyMarketHistory {
  const normalizedRequestedSymbol = normalizedHistorySymbol(requestedSymbol);
  const normalizedReturnedSymbol = normalizedHistorySymbol(history.symbol);

  if (history.provider !== providerName) {
    throw new Error(
      `Daily market history provider mismatch for ${normalizedRequestedSymbol}: expected ${providerName}, received ${history.provider}.`,
    );
  }
  if (normalizedReturnedSymbol !== normalizedRequestedSymbol) {
    throw new Error(
      `Daily market history symbol mismatch: requested ${normalizedRequestedSymbol}, received ${normalizedReturnedSymbol || "<empty>"}.`,
    );
  }

  return history;
}

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
    const getDailyHistory = provider.getDailyHistory.bind(provider);

    return Object.assign(provider, {
      // Treat the symbol/provider embedded in returned history as data-integrity boundaries. A paid
      // response for the wrong ticker or provider must never be persisted, rated, or converted into
      // a durable suppression reason for the candidate that happened to trigger the request.
      getDailyHistory: async (symbol: string, outputSize = 260) => assertMarketHistoryIdentity(
        await getDailyHistory(symbol, outputSize),
        symbol,
        provider.name,
      ),
      getCachedDailyHistory: async (symbol: string, outputSize = 260) => {
        if (!benchmarkHistoryCache) return null;
        const safeOutputSize = Math.min(Math.max(Math.trunc(outputSize), 60), 500);
        const history = await benchmarkHistoryCache.getFresh(
          symbol,
          provider.name,
          safeOutputSize,
          BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS,
        );
        return history === null
          ? null
          : assertMarketHistoryIdentity(history, symbol, provider.name);
      },
    });
  }

  return new UnconfiguredMarketDataProvider();
}
