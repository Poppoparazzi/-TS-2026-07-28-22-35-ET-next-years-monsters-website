// TS: 2026-08-21 17:08 UTC

export type MarketSession = "pre-market" | "regular" | "after-hours" | "closed" | "unknown";
export type DataFreshness = "live" | "near-live" | "delayed" | "end-of-day" | "stale" | "unavailable";

export interface QuoteSnapshot {
  readonly symbol: string;
  readonly companyName: string | null;
  readonly exchange: string | null;
  readonly currency: string;
  readonly price: number;
  readonly change: number | null;
  readonly percentChange: number | null;
  readonly volume: number | null;
  readonly marketSession: MarketSession;
  readonly freshness: DataFreshness;
  readonly provider: string;
  readonly providerTimestamp: string;
  readonly retrievedAt: string;
  readonly feedDisclosure: string;
}

export interface TickerSearchResult {
  readonly symbol: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly securityType: string | null;
  readonly active: boolean;
}

export interface DailyMarketBar {
  readonly date: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface DailyMarketHistory {
  readonly symbol: string;
  readonly bars: readonly DailyMarketBar[];
  readonly provider: string;
  readonly retrievedAt: string;
  readonly feedDisclosure: string;
}

export interface MarketDataProvider {
  readonly name: string;
  readonly configured: boolean;
  searchTickers(query: string, limit?: number): Promise<readonly TickerSearchResult[]>;
  getQuote(symbol: string): Promise<QuoteSnapshot>;
  getDailyHistory?(symbol: string, outputSize?: number): Promise<DailyMarketHistory>;
}

export class ProviderNotConfiguredError extends Error {
  public constructor(providerName: string) {
    super(`${providerName} is not configured.`);
    this.name = "ProviderNotConfiguredError";
  }
}
