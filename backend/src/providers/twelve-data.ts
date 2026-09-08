// TS: 2026-09-08 09:00 ET

import { randomUUID } from "node:crypto";
import type { BenchmarkHistoryCache } from "../database/benchmark-history-cache.js";
import {
  type DailyMarketBar,
  type DailyMarketHistory,
  type MarketDataProvider,
  type QuoteSnapshot,
  type TickerSearchResult,
} from "./types.js";

const BASE_URL = "https://api.twelvedata.com";
const FEED_DISCLOSURE =
  "Near-live U.S. market data from Twelve Data. This is not labeled as a full consolidated SIP quote.";
const DAILY_HISTORY_CACHE_TTL_MS = 15 * 60 * 1_000;
const DAILY_HISTORY_REFRESH_WAIT_MS = 10_000;
const DAILY_HISTORY_REFRESH_POLL_MS = 250;
const DAILY_HISTORY_PERSIST_RETRY_DELAYS_MS = [100, 250] as const;

// The HTTP app and startup rating worker can construct separate Twelve Data provider instances.
// Keep daily history at module scope so all symbols share same-process completed and in-flight
// requests. PostgreSQL persistence below extends the same quota protection across restarts.
const dailyHistoryCache = new Map<
  string,
  { readonly expiresAt: number; readonly history: DailyMarketHistory }
>();
const dailyHistoryInFlight = new Map<string, Promise<DailyMarketHistory>>();

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

interface TwelveDataTimeSeriesValue {
  readonly datetime?: string;
  readonly open?: string;
  readonly high?: string;
  readonly low?: string;
  readonly close?: string;
  readonly volume?: string;
}

interface TwelveDataTimeSeriesResponse extends TwelveDataErrorResponse {
  readonly meta?: {
    readonly symbol?: string;
  };
  readonly values?: readonly TwelveDataTimeSeriesValue[];
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function dailyHistoryCacheKey(symbol: string, outputSize: number): string {
  return `${symbol}:${outputSize}`;
}

function dailyHistoryCacheExpiry(history: DailyMarketHistory): number {
  const retrievedAtMs = Date.parse(history.retrievedAt);
  return Number.isFinite(retrievedAtMs)
    ? retrievedAtMs + DAILY_HISTORY_CACHE_TTL_MS
    : Date.now();
}

function trimDailyHistory(
  history: DailyMarketHistory,
  outputSize: number,
): DailyMarketHistory {
  if (history.bars.length <= outputSize) {
    return history;
  }

  return Object.freeze({
    ...history,
    bars: Object.freeze(history.bars.slice(-outputSize)),
  });
}

function findCompatibleDailyHistoryCache(
  symbol: string,
  outputSize: number,
): { readonly expiresAt: number; readonly history: DailyMarketHistory } | null {
  let bestOutputSize = Number.POSITIVE_INFINITY;
  let bestEntry: { readonly expiresAt: number; readonly history: DailyMarketHistory } | null = null;
  const prefix = `${symbol}:`;
  const now = Date.now();

  for (const [key, entry] of dailyHistoryCache) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    if (entry.expiresAt <= now) {
      dailyHistoryCache.delete(key);
      continue;
    }

    const cachedOutputSize = Number(key.slice(prefix.length));
    if (
      Number.isFinite(cachedOutputSize) &&
      cachedOutputSize > outputSize &&
      cachedOutputSize < bestOutputSize &&
      entry.history.bars.length >= outputSize
    ) {
      bestOutputSize = cachedOutputSize;
      bestEntry = entry;
    }
  }

  return bestEntry;
}

function findCompatibleDailyHistoryInFlight(
  symbol: string,
  outputSize: number,
): Promise<DailyMarketHistory> | null {
  let bestOutputSize = Number.POSITIVE_INFINITY;
  let bestRequest: Promise<DailyMarketHistory> | null = null;
  const prefix = `${symbol}:`;

  for (const [key, request] of dailyHistoryInFlight) {
    if (!key.startsWith(prefix)) {
      continue;
    }

    const inFlightOutputSize = Number(key.slice(prefix.length));
    if (
      Number.isFinite(inFlightOutputSize) &&
      inFlightOutputSize > outputSize &&
      inFlightOutputSize < bestOutputSize
    ) {
      bestOutputSize = inFlightOutputSize;
      bestRequest = request;
    }
  }

  return bestRequest;
}

export class TwelveDataMarketDataProvider implements MarketDataProvider {
  public readonly name = "twelve-data";
  public readonly configured = true;

  public constructor(
    private readonly apiKey: string,
    private readonly persistedBenchmarkHistoryCache?: BenchmarkHistoryCache,
  ) {
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
      const details = [
        payload.message?.trim(),
        `HTTP ${response.status}`,
        Number.isFinite(payload.code) ? `provider code ${payload.code}` : null,
      ].filter((value): value is string => Boolean(value));
      throw new Error(details.join(" | ") || "Twelve Data request failed.");
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

  public async getDailyHistory(
    symbol: string,
    outputSize = 260,
  ): Promise<DailyMarketHistory> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const safeOutputSize = Math.min(Math.max(Math.trunc(outputSize), 60), 500);
    const cacheKey = dailyHistoryCacheKey(normalizedSymbol, safeOutputSize);

    const cached = dailyHistoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.history;
    }
    if (cached) dailyHistoryCache.delete(cacheKey);

    const compatibleCached = findCompatibleDailyHistoryCache(
      normalizedSymbol,
      safeOutputSize,
    );
    if (compatibleCached) {
      const reusableHistory = trimDailyHistory(compatibleCached.history, safeOutputSize);
      dailyHistoryCache.set(cacheKey, {
        expiresAt: compatibleCached.expiresAt,
        history: reusableHistory,
      });
      return reusableHistory;
    }

    const exactInFlight = dailyHistoryInFlight.get(cacheKey);
    if (exactInFlight) {
      return exactInFlight;
    }

    const compatibleInFlight = findCompatibleDailyHistoryInFlight(
      normalizedSymbol,
      safeOutputSize,
    );
    if (compatibleInFlight) {
      const sharedHistory = await compatibleInFlight;
      if (sharedHistory.bars.length >= safeOutputSize) {
        const reusableHistory = trimDailyHistory(sharedHistory, safeOutputSize);
        dailyHistoryCache.set(cacheKey, {
          expiresAt: dailyHistoryCacheExpiry(reusableHistory),
          history: reusableHistory,
        });
        return reusableHistory;
      }
    }

    const loadHistory = async (): Promise<DailyMarketHistory> => {
      let refreshLeaseToken: string | null = null;
      let refreshLeaseAcquired = false;
      let keepRefreshLeaseUntilExpiry = false;

      if (this.persistedBenchmarkHistoryCache) {
        let persisted: DailyMarketHistory | null;
        try {
          persisted = await this.persistedBenchmarkHistoryCache.getFresh(
            normalizedSymbol,
            this.name,
            safeOutputSize,
            DAILY_HISTORY_CACHE_TTL_MS,
          );
        } catch {
          throw new Error(
            `Persisted daily market history lookup is unavailable for ${normalizedSymbol}.`,
          );
        }
        if (persisted) {
          dailyHistoryCache.set(cacheKey, {
            expiresAt: dailyHistoryCacheExpiry(persisted),
            history: persisted,
          });
          return persisted;
        }

        if (
          this.persistedBenchmarkHistoryCache.acquireRefreshLease &&
          this.persistedBenchmarkHistoryCache.releaseRefreshLease
        ) {
          refreshLeaseToken = randomUUID();
          let acquired: boolean;
          try {
            acquired = await this.persistedBenchmarkHistoryCache.acquireRefreshLease(
              normalizedSymbol,
              this.name,
              safeOutputSize,
              refreshLeaseToken,
            );
          } catch {
            // Fail closed on coordination uncertainty. An unguarded paid request here could
            // duplicate another process's Twelve Data spend when PostgreSQL is unhealthy.
            throw new Error(
              `Daily market history refresh coordination is unavailable for ${normalizedSymbol}.`,
            );
          }

          if (acquired === false) {
            const deadline = Date.now() + DAILY_HISTORY_REFRESH_WAIT_MS;
            while (Date.now() < deadline && acquired === false) {
              await delay(DAILY_HISTORY_REFRESH_POLL_MS);
              let refreshed: DailyMarketHistory | null;
              try {
                refreshed = await this.persistedBenchmarkHistoryCache.getFresh(
                  normalizedSymbol,
                  this.name,
                  safeOutputSize,
                  DAILY_HISTORY_CACHE_TTL_MS,
                );
              } catch {
                throw new Error(
                  `Persisted daily market history lookup is unavailable for ${normalizedSymbol}.`,
                );
              }
              if (refreshed) {
                dailyHistoryCache.set(cacheKey, {
                  expiresAt: dailyHistoryCacheExpiry(refreshed),
                  history: refreshed,
                });
                return refreshed;
              }

              // The competing refresh may have completed but produced fewer bars than this
              // caller requires. Only after rechecking persisted history may this caller try
              // to acquire the serialized lease and purchase the additional depth itself.
              try {
                acquired = await this.persistedBenchmarkHistoryCache.acquireRefreshLease(
                  normalizedSymbol,
                  this.name,
                  safeOutputSize,
                  refreshLeaseToken,
                );
              } catch {
                throw new Error(
                  `Daily market history refresh coordination is unavailable for ${normalizedSymbol}.`,
                );
              }
            }
            if (acquired === false) {
              throw new Error(`Daily market history refresh is already in progress for ${normalizedSymbol}.`);
            }
          }

          refreshLeaseAcquired = true;

          // Close the cache-miss/lease-acquisition race. Another worker can persist fresh
          // history after our first getFresh() but before this process obtains the lease.
          // Recheck while holding the lease so that already-paid history wins over a duplicate
          // Twelve Data request.
          let refreshedAfterLease: DailyMarketHistory | null;
          try {
            refreshedAfterLease = await this.persistedBenchmarkHistoryCache.getFresh(
              normalizedSymbol,
              this.name,
              safeOutputSize,
              DAILY_HISTORY_CACHE_TTL_MS,
            );
          } catch {
            await this.persistedBenchmarkHistoryCache
              .releaseRefreshLease(
                normalizedSymbol,
                this.name,
                safeOutputSize,
                refreshLeaseToken,
              )
              .catch(() => undefined);
            refreshLeaseAcquired = false;
            throw new Error(
              `Persisted daily market history lookup is unavailable for ${normalizedSymbol}.`,
            );
          }
          if (refreshedAfterLease) {
            dailyHistoryCache.set(cacheKey, {
              expiresAt: dailyHistoryCacheExpiry(refreshedAfterLease),
              history: refreshedAfterLease,
            });
            await this.persistedBenchmarkHistoryCache
              .releaseRefreshLease(
                normalizedSymbol,
                this.name,
                safeOutputSize,
                refreshLeaseToken,
              )
              .catch(() => undefined);
            refreshLeaseAcquired = false;
            return refreshedAfterLease;
          }
        }
      }

      try {
        const parameters = new URLSearchParams({
          symbol: normalizedSymbol,
          interval: "1day",
          outputsize: String(safeOutputSize),
          order: "ASC",
        });
        const payload = await this.request<TwelveDataTimeSeriesResponse>(
          "/time_series",
          parameters,
        );
        const bars = (payload.values ?? []).flatMap<DailyMarketBar>((value) => {
          const open = parseFiniteNumber(value.open);
          const high = parseFiniteNumber(value.high);
          const low = parseFiniteNumber(value.low);
          const close = parseFiniteNumber(value.close);
          const volume = parseFiniteNumber(value.volume);
          const date = value.datetime?.trim() ?? "";

          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            open === null || high === null || low === null || close === null || volume === null ||
            open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0
          ) {
            return [];
          }

          return [{ date, open, high, low, close, volume }];
        });

        bars.sort((left, right) => left.date.localeCompare(right.date));
        if (bars.length < 60) {
          throw new Error(
            `Insufficient daily market history was returned for ${normalizedSymbol}.`,
          );
        }

        const history = Object.freeze({
          symbol: payload.meta?.symbol?.toUpperCase() || normalizedSymbol,
          bars: Object.freeze(bars),
          provider: this.name,
          retrievedAt: new Date().toISOString(),
          feedDisclosure: FEED_DISCLOSURE,
        });

        dailyHistoryCache.set(cacheKey, {
          expiresAt: dailyHistoryCacheExpiry(history),
          history,
        });
        if (this.persistedBenchmarkHistoryCache) {
          let persisted = false;
          let lastPersistenceError: unknown = null;
          for (let attempt = 0; attempt <= DAILY_HISTORY_PERSIST_RETRY_DELAYS_MS.length; attempt += 1) {
            try {
              await this.persistedBenchmarkHistoryCache.save(history, safeOutputSize);
              persisted = true;
              break;
            } catch (error) {
              lastPersistenceError = error;
              const retryDelay = DAILY_HISTORY_PERSIST_RETRY_DELAYS_MS[attempt];
              if (retryDelay !== undefined) {
                await delay(retryDelay);
              }
            }
          }
          if (!persisted) {
            // Keep the database lease until its natural expiry. Releasing it here would let
            // another process immediately buy the same history that we already paid for.
            keepRefreshLeaseUntilExpiry = refreshLeaseAcquired;
            throw new Error(
              `Paid daily market history could not be persisted for ${normalizedSymbol}; refusing an immediate duplicate refresh.`,
              { cause: lastPersistenceError },
            );
          }
        }

        return history;
      } finally {
        if (
          refreshLeaseAcquired &&
          !keepRefreshLeaseUntilExpiry &&
          refreshLeaseToken &&
          this.persistedBenchmarkHistoryCache?.releaseRefreshLease
        ) {
          await this.persistedBenchmarkHistoryCache
            .releaseRefreshLease(
              normalizedSymbol,
              this.name,
              safeOutputSize,
              refreshLeaseToken,
            )
            .catch(() => undefined);
        }
      }
    };

    const historyRequest = loadHistory();
    dailyHistoryInFlight.set(cacheKey, historyRequest);

    try {
      return await historyRequest;
    } finally {
      if (dailyHistoryInFlight.get(cacheKey) === historyRequest) {
        dailyHistoryInFlight.delete(cacheKey);
      }
    }
  }
}
