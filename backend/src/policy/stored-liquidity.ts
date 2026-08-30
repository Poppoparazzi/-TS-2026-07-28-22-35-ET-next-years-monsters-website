// TS: 2026-08-30 02:03 ET

export const STORED_LIQUIDITY_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const STORED_LIQUIDITY_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

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

  if (dollarVolume === null || timestampMs === null || !Number.isFinite(nowMs)) {
    return Object.freeze({ fresh: false, dollarVolume, timestampMs });
  }

  const ageMs = nowMs - timestampMs;
  const fresh =
    ageMs >= -STORED_LIQUIDITY_FUTURE_TOLERANCE_MS &&
    ageMs <= STORED_LIQUIDITY_MAX_AGE_MS;

  return Object.freeze({ fresh, dollarVolume, timestampMs });
}
