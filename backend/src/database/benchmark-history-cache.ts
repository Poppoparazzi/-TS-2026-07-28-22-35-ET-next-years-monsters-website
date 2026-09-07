// TS: 2026-09-07 09:14 ET

import pg from "pg";
import type { DailyMarketBar, DailyMarketHistory } from "../providers/types.js";

const { Client } = pg;

export const BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS = 15 * 60 * 1_000;

export interface BenchmarkHistoryCache {
  getFresh(
    symbol: string,
    provider: string,
    outputSize: number,
    maxAgeMs?: number,
  ): Promise<DailyMarketHistory | null>;
  save(history: DailyMarketHistory, outputSize: number): Promise<void>;
}

interface BenchmarkHistoryRow {
  readonly symbol: string;
  readonly provider: string;
  readonly bars: unknown;
  readonly retrieved_at: Date | string;
  readonly feed_disclosure: string;
}

function normalizeSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    throw new Error("benchmark_history_cache_invalid_symbol");
  }
  return normalized;
}

function normalizeOutputSize(outputSize: number): number {
  const normalized = Math.trunc(outputSize);
  if (!Number.isInteger(normalized) || normalized < 60 || normalized > 500) {
    throw new Error("benchmark_history_cache_invalid_output_size");
  }
  return normalized;
}

function isDailyMarketBar(value: unknown): value is DailyMarketBar {
  if (!value || typeof value !== "object") return false;
  const bar = value as Partial<DailyMarketBar>;
  return (
    typeof bar.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(bar.date) &&
    typeof bar.open === "number" && Number.isFinite(bar.open) && bar.open > 0 &&
    typeof bar.high === "number" && Number.isFinite(bar.high) && bar.high > 0 &&
    typeof bar.low === "number" && Number.isFinite(bar.low) && bar.low > 0 &&
    typeof bar.close === "number" && Number.isFinite(bar.close) && bar.close > 0 &&
    typeof bar.volume === "number" && Number.isFinite(bar.volume) && bar.volume >= 0
  );
}

export class PostgresBenchmarkHistoryCache implements BenchmarkHistoryCache {
  public constructor(private readonly databaseUrl: string) {
    if (!databaseUrl.trim()) throw new Error("benchmark_history_cache_database_url_required");
  }

  private async withClient<T>(operation: (client: InstanceType<typeof Client>) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: this.databaseUrl });
    await client.connect();
    try {
      return await operation(client);
    } finally {
      await client.end();
    }
  }

  public async getFresh(
    symbol: string,
    provider: string,
    outputSize: number,
    maxAgeMs = BENCHMARK_HISTORY_PERSISTED_MAX_AGE_MS,
  ): Promise<DailyMarketHistory | null> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const normalizedProvider = provider.trim();
    const normalizedOutputSize = normalizeOutputSize(outputSize);
    if (!normalizedProvider) throw new Error("benchmark_history_cache_provider_required");
    if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
      throw new Error("benchmark_history_cache_invalid_max_age");
    }

    return this.withClient(async (client) => {
      const result = await client.query<BenchmarkHistoryRow>(
        `
          SELECT symbol, provider, bars, retrieved_at, feed_disclosure
          FROM benchmark_history_cache
          WHERE symbol = $1
            AND provider = $2
            AND output_size = $3
            AND retrieved_at >= now() - ($4::double precision * interval '1 millisecond')
          ORDER BY retrieved_at DESC
          LIMIT 1
        `,
        [normalizedSymbol, normalizedProvider, normalizedOutputSize, maxAgeMs],
      );
      const row = result.rows[0];
      if (!row || !Array.isArray(row.bars) || row.bars.length < 60 || !row.bars.every(isDailyMarketBar)) {
        return null;
      }
      const retrievedAt = row.retrieved_at instanceof Date
        ? row.retrieved_at.toISOString()
        : new Date(row.retrieved_at).toISOString();
      if (!Number.isFinite(Date.parse(retrievedAt))) return null;

      return Object.freeze({
        symbol: row.symbol.toUpperCase(),
        bars: Object.freeze([...row.bars]),
        provider: row.provider,
        retrievedAt,
        feedDisclosure: row.feed_disclosure,
      });
    });
  }

  public async save(history: DailyMarketHistory, outputSize: number): Promise<void> {
    const normalizedSymbol = normalizeSymbol(history.symbol);
    const normalizedProvider = history.provider.trim();
    const normalizedOutputSize = normalizeOutputSize(outputSize);
    if (!normalizedProvider) throw new Error("benchmark_history_cache_provider_required");
    if (!history.feedDisclosure.trim()) throw new Error("benchmark_history_cache_disclosure_required");
    if (!Array.isArray(history.bars) || history.bars.length < 60 || !history.bars.every(isDailyMarketBar)) {
      throw new Error("benchmark_history_cache_invalid_bars");
    }
    if (!Number.isFinite(Date.parse(history.retrievedAt))) {
      throw new Error("benchmark_history_cache_invalid_retrieved_at");
    }

    await this.withClient(async (client) => {
      await client.query(
        `
          INSERT INTO benchmark_history_cache (
            symbol,
            provider,
            output_size,
            bars,
            retrieved_at,
            feed_disclosure
          )
          VALUES ($1, $2, $3, $4::jsonb, $5, $6)
          ON CONFLICT (symbol, provider, output_size) DO UPDATE SET
            bars = EXCLUDED.bars,
            retrieved_at = EXCLUDED.retrieved_at,
            feed_disclosure = EXCLUDED.feed_disclosure
          WHERE EXCLUDED.retrieved_at >= benchmark_history_cache.retrieved_at
        `,
        [
          normalizedSymbol,
          normalizedProvider,
          normalizedOutputSize,
          JSON.stringify(history.bars),
          history.retrievedAt,
          history.feedDisclosure,
        ],
      );
    });
  }
}
