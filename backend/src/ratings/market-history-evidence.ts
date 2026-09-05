// TS: 2026-09-05 15:00 ET

import type { DailyMarketHistory } from "../providers/types.js";

export const MINIMUM_RATING_HISTORY_BARS = 253;
const MARKET_DATA_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export interface MarketHistoryEvidence {
  readonly symbol: string;
  readonly provider: string;
  readonly usableBarCount: number;
  readonly latestBarDate: string | null;
  readonly twentySessionAverageDollarVolume?: number | null;
  readonly suppressionReason?: "insufficient_liquidity" | "stale_market_data" | null;
  readonly retrievedAt: string;
  readonly feedDisclosure: string;
}

export function buildMarketHistoryEvidence(history: DailyMarketHistory): MarketHistoryEvidence {
  const retrievedAtMs = Date.parse(history.retrievedAt);
  const usableBars = history.bars
    .filter((bar) => {
      const barDateMs = /^\d{4}-\d{2}-\d{2}$/.test(bar.date)
        ? Date.parse(`${bar.date}T00:00:00.000Z`)
        : Number.NaN;
      return Number.isFinite(bar.close) && bar.close > 0 &&
        Number.isFinite(bar.volume) && bar.volume >= 0 &&
        Number.isFinite(barDateMs) &&
        (!Number.isFinite(retrievedAtMs) || barDateMs <= retrievedAtMs);
    })
    .sort((left, right) => left.date.localeCompare(right.date));
  const recentBars = usableBars.slice(-20);
  const latestBarDate = usableBars.at(-1)?.date ?? null;
  const twentySessionAverageDollarVolume = recentBars.length > 0
    ? recentBars.reduce((total, bar) => total + (bar.close * bar.volume), 0) / recentBars.length
    : null;
  const latestBarMs = latestBarDate === null ? Number.NaN : Date.parse(latestBarDate);
  const staleMarketData =
    Number.isFinite(retrievedAtMs) && Number.isFinite(latestBarMs) &&
    retrievedAtMs - latestBarMs > MARKET_DATA_STALE_AFTER_MS;

  return Object.freeze({
    symbol: history.symbol.trim().toUpperCase(),
    provider: history.provider,
    usableBarCount: usableBars.length,
    latestBarDate,
    twentySessionAverageDollarVolume,
    suppressionReason: staleMarketData ? "stale_market_data" : null,
    retrievedAt: history.retrievedAt,
    feedDisclosure: history.feedDisclosure,
  });
}

export function hasMinimumRatingHistoryEvidence(evidence: MarketHistoryEvidence): boolean {
  return evidence.usableBarCount >= MINIMUM_RATING_HISTORY_BARS;
}
