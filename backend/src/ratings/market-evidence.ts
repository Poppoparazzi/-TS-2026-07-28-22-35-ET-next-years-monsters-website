// TS: 2026-08-10 10:16 UTC

import { MAXIMUM_MARKET_DATA_AGE_DAYS } from "./spec-v1.js";
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

export interface RawCurrentQuote {
  readonly symbol: string;
  readonly price: number | null | undefined;
  readonly observedAt: string | null | undefined;
  readonly fetchedAt: string | null | undefined;
  readonly providerName: string | null | undefined;
  readonly providerConfigured: boolean;
}

export interface VerifiedCurrentQuoteEvidence {
  readonly symbol: string;
  readonly price: number;
  readonly observedAt: string;
  readonly fetchedAt: string;
  readonly providerName: string;
}

export interface CurrentQuoteEvidenceFailure {
  readonly verified: false;
  readonly reason:
    | "provider_not_connected"
    | "missing_symbol"
    | "invalid_quote_price"
    | "invalid_quote_timestamp"
    | "quote_from_future"
    | "stale_quote";
  readonly missingEvidence: readonly string[];
}

export interface CurrentQuoteEvidenceSuccess {
  readonly verified: true;
  readonly evidence: VerifiedCurrentQuoteEvidence;
}

export type CurrentQuoteEvidenceResult = CurrentQuoteEvidenceFailure | CurrentQuoteEvidenceSuccess;

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

export function verifyCurrentQuoteEvidence(
  source: RawCurrentQuote,
  calculatedAt: string,
): CurrentQuoteEvidenceResult {
  const providerName = source.providerName?.trim() ?? "";
  if (!source.providerConfigured || !providerName) {
    return Object.freeze({
      verified: false,
      reason: "provider_not_connected",
      missingEvidence: Object.freeze(["licensed current-quote provider", "quote provider provenance"]),
    });
  }

  const symbol = source.symbol.trim().toUpperCase();
  if (!symbol) {
    return Object.freeze({
      verified: false,
      reason: "missing_symbol",
      missingEvidence: Object.freeze(["current-quote symbol identity"]),
    });
  }

  if (typeof source.price !== "number" || !Number.isFinite(source.price) || source.price <= 0) {
    return Object.freeze({
      verified: false,
      reason: "invalid_quote_price",
      missingEvidence: Object.freeze(["positive machine-readable current quote"]),
    });
  }

  if (
    !source.observedAt ||
    !source.fetchedAt ||
    !validIsoDate(source.observedAt) ||
    !validIsoDate(source.fetchedAt) ||
    !validIsoDate(calculatedAt)
  ) {
    return Object.freeze({
      verified: false,
      reason: "invalid_quote_timestamp",
      missingEvidence: Object.freeze(["current-quote observation timestamp", "current-quote fetch timestamp"]),
    });
  }

  const observedMs = Date.parse(source.observedAt);
  const fetchedMs = Date.parse(source.fetchedAt);
  const calculatedMs = Date.parse(calculatedAt);
  if (observedMs > fetchedMs || fetchedMs > calculatedMs) {
    return Object.freeze({
      verified: false,
      reason: "quote_from_future",
      missingEvidence: Object.freeze(["chronologically valid current-quote timestamps"]),
    });
  }

  const maximumAgeMs = MAXIMUM_MARKET_DATA_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (calculatedMs - observedMs > maximumAgeMs || calculatedMs - fetchedMs > maximumAgeMs) {
    return Object.freeze({
      verified: false,
      reason: "stale_quote",
      missingEvidence: Object.freeze(["fresh current quote within the versioned market-data window"]),
    });
  }

  return Object.freeze({
    verified: true,
    evidence: Object.freeze({
      symbol,
      price: source.price,
      observedAt: source.observedAt,
      fetchedAt: source.fetchedAt,
      providerName,
    }),
  });
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
