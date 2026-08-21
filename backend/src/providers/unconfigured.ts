// TS: 2026-08-21 17:08 UTC

import {
  type DailyMarketHistory,
  type MarketDataProvider,
  ProviderNotConfiguredError,
  type QuoteSnapshot,
  type TickerSearchResult,
} from "./types.js";

export class UnconfiguredMarketDataProvider implements MarketDataProvider {
  public readonly name = "unconfigured";
  public readonly configured = false;

  public async searchTickers(
    _query: string,
    _limit = 10,
  ): Promise<readonly TickerSearchResult[]> {
    throw new ProviderNotConfiguredError(this.name);
  }

  public async getQuote(_symbol: string): Promise<QuoteSnapshot> {
    throw new ProviderNotConfiguredError(this.name);
  }

  public async getDailyHistory(
    _symbol: string,
    _outputSize = 260,
  ): Promise<DailyMarketHistory> {
    throw new ProviderNotConfiguredError(this.name);
  }
}
