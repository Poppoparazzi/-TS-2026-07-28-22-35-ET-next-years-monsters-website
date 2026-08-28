// TS: 2026-08-28 07:09 ET

import type { DailyMarketHistory } from "../providers/types.js";

export interface MarketHistoryEvidence {
  readonly symbol: string;
  readonly provider: string;
  readonly usableBarCount: number;
  readonly latestBarDate: string | null;
  readonly retrievedAt: string;
  readonly feedDisclosure: string;
}

export function buildMarketHistoryEvidence(history: DailyMarketHistory): MarketHistoryEvidence {
  const usableBars = history.bars
    .filter((bar) =>
      Number.isFinite(bar.close) && bar.close > 0 &&
      Number.isFinite(bar.volume) && bar.volume >= 0
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  return Object.freeze({
    symbol: history.symbol.trim().toUpperCase(),
    provider: history.provider,
    usableBarCount: usableBars.length,
    latestBarDate: usableBars.at(-1)?.date ?? null,
    retrievedAt: history.retrievedAt,
    feedDisclosure: history.feedDisclosure,
  });
}
