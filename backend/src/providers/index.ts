// TS: 2026-09-09 11:57 ET

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

export function createMarketHistoryIdentityGuard(
  providerName: string,
  getDailyHistory: (symbol: string, outputSize?: number) => Promise<DailyMarketHistory>,
): (symbol: string, outputSize?: number) => Promise<DailyMarketHistory> {
  let blockedError: Error | null = null;

  return async (symbol: string, outputSize = 260) => {
    if (blockedError) throw blockedError;

    try {
      return assertMarketHistoryIdentity(
        await getDailyHistory(symbol, outputSize),
        symbol,
        providerName,
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      blockedError = new Error(
        `Market-data provider service unavailable after identity-integrity failure: ${detail}`,
      );
      throw blockedError;
    }
  };
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
    const getDailyHistory = createMarketHistoryIdentityGuard(
      provider.name,
      provider.getDailyHistory.bind(provider),
    );

    return Object.assign(provider, {
      // Treat the symbol/provider embedded in returned history as a data-integrity boundary. Once a
      // paid response crosses that boundary, trip a process-local circuit breaker before another
      // paid history request can be sent. The batch recognizes the service-unavailable error as a
      // run-level stop instead of walking the 5,000-company reserve through corrupted responses.
      getDailyHistory,
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
