// TS: 2026-08-05 07:57 ET

import {
  type DailyMarketBar,
  type DailyMarketHistory,
  type MarketDataProvider,
  type QuoteSnapshot,
  type TickerSearchResult,
} from "./types.js";

const BASE_URL = "https://api.twelvedata.com";
const FEED_DISCLOSURE =
  "External Market Data · May Be Delayed. Twelve Data supplies this market information; it is not labeled as a full consolidated SIP quote.";

interface TwelveDataErrorResponse {
  readonly status?: string;
  readonly code?: number;
  readonly message?: string;
}

interface TwelveDataQuoteResponse extends TwelveDataErrorResponse {
  readonly symbol?: string;
  readonly name?: string;
  readonly exchange?: string;
  readonly currency?: string;
  readonly timestamp?: number;
  readonly close?: string;
  readonly volume?: string;
  readonly change?: string;
  readonly percent_change?: string;
  readonly is_market_open?: boolean;
}

interface TwelveDataSearchItem {
  readonly symbol?: string;
  readonly instrument_name?: string;
  readonly exchange?: string;
  readonly instrument_type?: string;
  readonly country?: string;
}

interface TwelveDataSearchResponse extends TwelveDataErrorResponse {
  readonly data?: readonly TwelveDataSearchItem[];
}

interface TwelveDataTimeSeriesMeta {
  readonly symbol?: string;
  readonly interval?: string;
  readonly currency?: string;
  readonly exchange?: string;
  readonly type?: string;
}

interface TwelveDataTimeSeriesValue {
  readonly datetime?: string;
  readonly open?: string;
  readonly high?: string;
  readonly low?: string;
  readonly close?: string;
  readonly volume?: string;
}

interface TwelveDataTimeSeriesResponse extends TwelveDataErrorResponse {
  readonly meta?: TwelveDataTimeSeriesMeta;
  readonly values?: readonly TwelveDataTimeSeriesValue[];
}

function parseFiniteNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return normalized;
}

function normalizeDailyBar(value: TwelveDataTimeSeriesValue): DailyMarketBar | null {
  const date = value.datetime?.slice(0, 10) ?? "";
  const open = parseFiniteNumber(value.open);
  const high = parseFiniteNumber(value.high);
  const low = parseFiniteNumber(value.low);
  const close = parseFiniteNumber(value.close);
  const volume = parseFiniteNumber(value.volume);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null ||
    open <= 0 ||
    high <= 0 ||
    low <= 0 ||
    close <= 0 ||
    volume < 0 ||
    high < low
  ) {
    return null;
  }

  return Object.freeze({ date, open, high, low, close, volume });
}

export class TwelveDataMarketDataProvider implements MarketDataProvider {
  public readonly name = "twelve-data";
  public readonly configured = true;

  public constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) throw new Error("Twelve Data API key is required.");
  }

  private async request<T>(path: string, parameters: URLSearchParams): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}?${parameters.toString()}`, {
      headers: {
        Authorization: `apikey ${this.apiKey}`,
        Accept: "application/json",
        "User-Agent": "NextYearsMonsters/0.7",
      },
      signal: AbortSignal.timeout(12_000),
    });

    const payload = (await response.json()) as T & TwelveDataErrorResponse;
    if (!response.ok || payload.status === "error") {
      const reason = payload.message || `Twelve Data request failed with HTTP ${response.status}.`;
      throw new Error(reason);
    }
    return payload;
  }

  public async searchTickers(
    query: string,
    limit = 10,
  ): Promise<readonly TickerSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 1) return [];

    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
    const parameters = new URLSearchParams({
      symbol: trimmed,
      outputsize: String(safeLimit),
    });
    const payload = await this.request<TwelveDataSearchResponse>("/symbol_search", parameters);

    return (payload.data ?? [])
      .filter((item) => item.country === "United States")
      .filter((item) => item.instrument_type === "Common Stock")
      .flatMap((item) => {
        if (!item.symbol || !item.instrument_name) return [];
        return [
          {
            symbol: item.symbol.toUpperCase(),
            companyName: item.instrument_name,
            exchange: item.exchange ?? null,
            securityType: item.instrument_type ?? null,
            active: true,
          } satisfies TickerSearchResult,
        ];
      })
      .slice(0, safeLimit);
  }

  public async getQuote(symbol: string): Promise<QuoteSnapshot> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const parameters = new URLSearchParams({ symbol: normalizedSymbol });
    const payload = await this.request<TwelveDataQuoteResponse>("/quote", parameters);
    const price = parseFiniteNumber(payload.close);
    if (price === null) {
      throw new Error(`No usable quote was returned for ${normalizedSymbol}.`);
    }

    const retrievedAt = new Date().toISOString();
    const providerTimestamp = payload.timestamp
      ? new Date(payload.timestamp * 1_000).toISOString()
      : retrievedAt;

    return {
      symbol: payload.symbol?.toUpperCase() || normalizedSymbol,
      companyName: payload.name ?? null,
      exchange: payload.exchange ?? null,
      currency: payload.currency || "USD",
      price,
      change: parseFiniteNumber(payload.change),
      percentChange: parseFiniteNumber(payload.percent_change),
      volume: parseFiniteNumber(payload.volume),
      marketSession: payload.is_market_open === true ? "regular" : "unknown",
      freshness: "near-live",
      provider: this.name,
      providerTimestamp,
      retrievedAt,
      feedDisclosure: FEED_DISCLOSURE,
    };
  }

  public async getDailyHistory(symbol: string, outputsize = 260): Promise<DailyMarketHistory> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const safeOutputsize = Math.min(Math.max(Math.trunc(outputsize), 1), 5_000);
    const parameters = new URLSearchParams({
      symbol: normalizedSymbol,
      interval: "1day",
      outputsize: String(safeOutputsize),
      order: "asc",
    });
    const payload = await this.request<TwelveDataTimeSeriesResponse>(
      "/time_series",
      parameters,
    );
    const bars = (payload.values ?? [])
      .map(normalizeDailyBar)
      .filter((bar): bar is DailyMarketBar => bar !== null)
      .sort((left, right) => left.date.localeCompare(right.date));

    if (bars.length === 0) {
      throw new Error(`No usable daily market history was returned for ${normalizedSymbol}.`);
    }

    return Object.freeze({
      symbol: payload.meta?.symbol?.toUpperCase() || normalizedSymbol,
      companyName: null,
      exchange: payload.meta?.exchange ?? null,
      securityType: payload.meta?.type ?? null,
      currency: payload.meta?.currency || "USD",
      interval: "1day",
      bars: Object.freeze(bars),
      provider: this.name,
      retrievedAt: new Date().toISOString(),
      feedDisclosure: FEED_DISCLOSURE,
    });
  }
}
