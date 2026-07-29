// TS: 2026-07-29 10:44 ET

import {
  type MarketDataProvider,
  type QuoteSnapshot,
  type TickerSearchResult,
} from "./types.js";

const BASE_URL = "https://api.twelvedata.com";
const FEED_DISCLOSURE =
  "Near-live U.S. market data from Twelve Data. This is not labeled as a full consolidated SIP quote.";

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

function parseFiniteNumber(value: string | number | undefined): number | null {
  if (value === undefined) {
    return null;
  }

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

export class TwelveDataMarketDataProvider implements MarketDataProvider {
  public readonly name = "twelve-data";
  public readonly configured = true;

  public constructor(private readonly apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error("Twelve Data API key is required.");
    }
  }

  private async request<T>(path: string, parameters: URLSearchParams): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}?${parameters.toString()}`, {
      headers: {
        Authorization: `apikey ${this.apiKey}`,
        Accept: "application/json",
        "User-Agent": "NextYearsMonsters/0.1",
      },
      signal: AbortSignal.timeout(8_000),
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

    if (trimmed.length < 1) {
      return [];
    }

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
        if (!item.symbol || !item.instrument_name) {
          return [];
        }

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
}
