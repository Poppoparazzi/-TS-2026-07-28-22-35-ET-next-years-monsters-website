// TS: 2026-08-01 17:24 ET

import type { MarketDataProvider, QuoteSnapshot } from "../providers/types.js";

export interface QuoteBatchSuccess {
  readonly symbol: string;
  readonly status: "ok";
  readonly quote: QuoteSnapshot;
}

export interface QuoteBatchFailure {
  readonly symbol: string;
  readonly status: "error";
  readonly error: "quote_unavailable";
  readonly message: string;
}

export type QuoteBatchResult = QuoteBatchSuccess | QuoteBatchFailure;

interface CachedQuote {
  readonly quote: QuoteSnapshot;
  readonly expiresAt: number;
}

export interface QuoteServiceOptions {
  readonly cacheTtlMs?: number | undefined;
  readonly batchConcurrency?: number | undefined;
  readonly now?: (() => number) | undefined;
}

export class QuoteService {
  private readonly cache = new Map<string, CachedQuote>();
  private readonly inFlight = new Map<string, Promise<QuoteSnapshot>>();
  private readonly cacheTtlMs: number;
  private readonly batchConcurrency: number;
  private readonly now: () => number;

  public constructor(
    private readonly provider: MarketDataProvider,
    options: QuoteServiceOptions = {},
  ) {
    this.cacheTtlMs = Math.max(options.cacheTtlMs ?? 60_000, 1_000);
    this.batchConcurrency = Math.min(Math.max(options.batchConcurrency ?? 4, 1), 8);
    this.now = options.now ?? Date.now;
  }

  public async getQuote(symbol: string): Promise<QuoteSnapshot> {
    const cached = this.cache.get(symbol);
    const now = this.now();

    if (cached && cached.expiresAt > now) {
      return cached.quote;
    }

    const existing = this.inFlight.get(symbol);
    if (existing) {
      return existing;
    }

    const request = this.provider
      .getQuote(symbol)
      .then((quote) => {
        this.cache.set(symbol, {
          quote,
          expiresAt: this.now() + this.cacheTtlMs,
        });
        return quote;
      })
      .finally(() => {
        this.inFlight.delete(symbol);
      });

    this.inFlight.set(symbol, request);
    return request;
  }

  public async getQuotes(symbols: readonly string[]): Promise<readonly QuoteBatchResult[]> {
    const results: Array<QuoteBatchResult | undefined> = new Array(symbols.length);
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < symbols.length) {
        const index = nextIndex;
        nextIndex += 1;
        const symbol = symbols[index];
        if (!symbol) continue;

        try {
          const quote = await this.getQuote(symbol);
          results[index] = { symbol, status: "ok", quote };
        } catch (_error) {
          results[index] = {
            symbol,
            status: "error",
            error: "quote_unavailable",
            message: "The market-data provider could not return a usable quote.",
          };
        }
      }
    };

    const workerCount = Math.min(this.batchConcurrency, symbols.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return results.filter((result): result is QuoteBatchResult => result !== undefined);
  }
}
