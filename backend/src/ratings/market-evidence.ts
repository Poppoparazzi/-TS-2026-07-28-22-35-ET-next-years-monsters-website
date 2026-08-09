// TS: 2026-08-09 16:02 ET

import type { MarketBarEvidence } from "./types.js";

export interface RawMarketBar {
  readonly date: string;
  readonly close: number | null | undefined;
  readonly volume: number | null | undefined;
}

export interface MarketEvidenceSource {
  readonly providerName: string | null;
  readonly providerConfigured: boolean;
  readonly fetchedAt: string | null;
  readonly symbol: string;
  readonly bars: readonly RawMarketBar[];
}

export interface VerifiedMarketEvidence {
  readonly providerName: string;
  readonly fetchedAt: string;
  readonly symbol: string;
  readonly bars: readonly MarketBarEvidence[];
  readonly latestObservationDate: string;
}

export interface MarketEvidenceFailure {
  readonly verified: false;
  readonly reason:
    | "provider_not_connected"
    | "invalid_fetch_timestamp"
    | "missing_symbol"
    | "no_valid_market_bars";
  readonly missingEvidence: readonly string[];
}

export interface MarketEvidenceSuccess {
  readonly verified: true;
  readonly evidence: VerifiedMarketEvidence;
}

export type MarketEvidenceResult = MarketEvidenceFailure | MarketEvidenceSuccess;

function validIsoDate(value: string): boolean {
  const parsed = Date.parse(value);
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) && Number.isFinite(parsed);
}

function normalizeBars(rawBars: readonly RawMarketBar[]): readonly MarketBarEvidence[] {
  const byDate = new Map<string, MarketBarEvidence>();

  for (const raw of rawBars) {
    if (!validIsoDate(raw.date)) continue;
    if (typeof raw.close !== "number" || !Number.isFinite(raw.close) || raw.close <= 0) continue;
    if (typeof raw.volume !== "number" || !Number.isFinite(raw.volume) || raw.volume < 0) continue;

    const date = raw.date.slice(0, 10);
    byDate.set(date, Object.freeze({ date, close: raw.close, volume: raw.volume }));
  }

  return Object.freeze([...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)));
}

export function verifyMarketEvidence(source: MarketEvidenceSource): MarketEvidenceResult {
  const providerName = source.providerName?.trim() ?? "";
  if (!source.providerConfigured || !providerName) {
    return Object.freeze({
      verified: false,
      reason: "provider_not_connected",
      missingEvidence: Object.freeze(["licensed market-data provider", "provider provenance"]),
    });
  }

  if (!source.fetchedAt || !validIsoDate(source.fetchedAt)) {
    return Object.freeze({
      verified: false,
      reason: "invalid_fetch_timestamp",
      missingEvidence: Object.freeze(["machine-readable market-data fetch timestamp"]),
    });
  }

  const symbol = source.symbol.trim().toUpperCase();
  if (!symbol) {
    return Object.freeze({
      verified: false,
      reason: "missing_symbol",
      missingEvidence: Object.freeze(["market-data symbol identity"]),
    });
  }

  const bars = normalizeBars(source.bars);
  const latest = bars.at(-1);
  if (!latest) {
    return Object.freeze({
      verified: false,
      reason: "no_valid_market_bars",
      missingEvidence: Object.freeze(["verified closing-price history", "verified volume history"]),
    });
  }

  return Object.freeze({
    verified: true,
    evidence: Object.freeze({
      providerName,
      fetchedAt: source.fetchedAt,
      symbol,
      bars,
      latestObservationDate: latest.date,
    }),
  });
}
