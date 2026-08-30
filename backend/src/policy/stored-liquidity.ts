// TS: 2026-08-30 18:01 ET

export const STORED_LIQUIDITY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const STORED_LIQUIDITY_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type StoredLiquidityReason =
  | "fresh"
  | "missing_quote_values"
  | "missing_timestamp"
  | "malformed_provider_timestamp"
  | "stale_timestamp"
  | "future_timestamp";

export interface StoredLiquiditySnapshot {
  readonly price?: unknown;
  readonly volume?: unknown;
  readonly providerTimestamp?: unknown;
  readonly retrievedAt?: unknown;
}

export interface StoredLiquidityEvidence {
  readonly fresh: boolean;
  readonly dollarVolume: number | null;
  readonly timestampMs: number | null;
  readonly reason: StoredLiquidityReason;
}

export interface StoredLiquidityRankable {
  readonly filingCount: number;
  readonly factCount: number;
  readonly ratingCount: number;
  readonly ticker: string;
  readonly liquidity: StoredLiquidityEvidence;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateStoredLiquidity(
  quote: StoredLiquiditySnapshot | null | undefined,
  nowMs = Date.now(),
): StoredLiquidityEvidence {
  const price = Number(quote?.price);
  const volume = Number(quote?.volume);
  const providerTimestampPresent =
    typeof quote?.providerTimestamp === "string" && quote.providerTimestamp.trim() !== "";
  const providerTimestampMs = parseTimestamp(quote?.providerTimestamp);
  const retrievedAtMs = parseTimestamp(quote?.retrievedAt);
  const timestampMs = providerTimestampPresent ? providerTimestampMs : retrievedAtMs;
  const dollarVolume =
    Number.isFinite(price) && price > 0 && Number.isFinite(volume) && volume > 0
      ? price * volume
      : null;

  if (dollarVolume === null) {
    return Object.freeze({
      fresh: false,
      dollarVolume,
      timestampMs,
      reason: "missing_quote_values" as const,
    });
  }

  if (providerTimestampPresent && providerTimestampMs === null) {
    return Object.freeze({
      fresh: false,
      dollarVolume,
      timestampMs: null,
      reason: "malformed_provider_timestamp" as const,
    });
  }

  if (timestampMs === null || !Number.isFinite(nowMs)) {
    return Object.freeze({
      fresh: false,
      dollarVolume,
      timestampMs,
      reason: "missing_timestamp" as const,
    });
  }

  const ageMs = nowMs - timestampMs;
  if (ageMs < -STORED_LIQUIDITY_FUTURE_TOLERANCE_MS) {
    return Object.freeze({
      fresh: false,
      dollarVolume,
      timestampMs,
      reason: "future_timestamp" as const,
    });
  }

  if (ageMs > STORED_LIQUIDITY_MAX_AGE_MS) {
    return Object.freeze({
      fresh: false,
      dollarVolume,
      timestampMs,
      reason: "stale_timestamp" as const,
    });
  }

  return Object.freeze({
    fresh: true,
    dollarVolume,
    timestampMs,
    reason: "fresh" as const,
  });
}

export function compareStoredLiquidityPriority(
  left: StoredLiquidityRankable,
  right: StoredLiquidityRankable,
): number {
  const leftLiquidity = left.liquidity.fresh && Number.isFinite(left.liquidity.dollarVolume)
    ? Number(left.liquidity.dollarVolume)
    : -1;
  const rightLiquidity = right.liquidity.fresh && Number.isFinite(right.liquidity.dollarVolume)
    ? Number(right.liquidity.dollarVolume)
    : -1;

  return (
    Number(right.liquidity.fresh) - Number(left.liquidity.fresh) ||
    rightLiquidity - leftLiquidity ||
    right.filingCount - left.filingCount ||
    right.factCount - left.factCount ||
    left.ratingCount - right.ratingCount ||
    left.ticker.localeCompare(right.ticker)
  );
}

export function selectStoredLiquidityQualificationPool<T extends StoredLiquidityRankable>(
  items: readonly T[],
  poolSize: number,
): readonly T[] {
  const safePoolSize = Number.isFinite(poolSize)
    ? Math.max(Math.floor(poolSize), 0)
    : 0;
  const ranked = [...items].sort(compareStoredLiquidityPriority);
  const uniqueByTicker = new Map<string, T>();

  for (const item of ranked) {
    const normalizedTicker = String(item.ticker || "").trim().toUpperCase();
    if (!normalizedTicker || uniqueByTicker.has(normalizedTicker)) continue;
    uniqueByTicker.set(normalizedTicker, item);
  }

  return Object.freeze([...uniqueByTicker.values()].slice(0, safePoolSize));
}
