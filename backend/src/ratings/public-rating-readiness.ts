// TS: 2026-08-21 17:08 UTC

import type { QuoteSnapshot } from "../providers/types.js";
import type { SecCompany, SecCompanyFactsSummary } from "../sec/types.js";

const MAX_QUOTE_AGE_MS = 36 * 60 * 60 * 1000;
const MAX_END_OF_DAY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_SEC_FACT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface ExplicitRiskEvidence {
  readonly symbol: string;
  readonly verified: boolean;
  readonly source: string;
  readonly retrievedAt: string;
}

export interface ExplicitVersionedCalculation {
  readonly symbol: string;
  readonly score: number;
  readonly modelVersion: string;
  readonly calculatedAt: string;
}

export interface PublicRatingReadinessInput {
  readonly symbol: string;
  readonly quote: QuoteSnapshot | null;
  readonly secCompany: SecCompany | null;
  readonly secFacts: SecCompanyFactsSummary | null;
  readonly riskEvidence?: ExplicitRiskEvidence | null;
  readonly calculation?: ExplicitVersionedCalculation | null;
  readonly now?: Date;
}

export interface PublicRatingReadinessGate {
  readonly ready: boolean;
  readonly reason: string;
}

export interface PublicRatingReadinessResult {
  readonly symbol: string;
  readonly ready: boolean;
  readonly status: "ready" | "not_yet_rated";
  readonly score: number | null;
  readonly modelVersion: string | null;
  readonly gates: {
    readonly secIdentity: PublicRatingReadinessGate;
    readonly marketQuote: PublicRatingReadinessGate;
    readonly quoteFreshness: PublicRatingReadinessGate;
    readonly financialEvidence: PublicRatingReadinessGate;
    readonly riskEvidence: PublicRatingReadinessGate;
    readonly versionedCalculation: PublicRatingReadinessGate;
  };
}

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampIsCurrent(value: string, nowMs: number, maxAgeMs: number): boolean {
  const parsed = parseTimestamp(value);
  if (parsed === null) return false;
  const ageMs = nowMs - parsed;
  return ageMs >= -FUTURE_TOLERANCE_MS && ageMs <= maxAgeMs;
}

function pass(reason: string): PublicRatingReadinessGate {
  return Object.freeze({ ready: true, reason });
}

function fail(reason: string): PublicRatingReadinessGate {
  return Object.freeze({ ready: false, reason });
}

export function evaluatePublicRatingReadiness(
  input: PublicRatingReadinessInput,
): PublicRatingReadinessResult {
  const symbol = normalizeSymbol(input.symbol);
  const nowMs = (input.now ?? new Date()).getTime();

  const secIdentity =
    input.secCompany &&
    normalizeSymbol(input.secCompany.ticker) === symbol &&
    Number.isInteger(input.secCompany.cik) &&
    input.secCompany.cik > 0 &&
    input.secCompany.sourceUrl.startsWith("https://www.sec.gov/")
      ? pass(`SEC identity explicitly matches ${symbol}.`)
      : fail("Verified SEC identity is missing or does not match the requested ticker.");

  const marketQuote =
    input.quote &&
    normalizeSymbol(input.quote.symbol) === symbol &&
    Number.isFinite(input.quote.price) &&
    input.quote.price > 0 &&
    input.quote.provider.trim().length > 0
      ? pass(`Verified quote explicitly matches ${symbol}.`)
      : fail("A positive ticker-matched quote with provider provenance is required.");

  const quoteFreshness =
    input.quote &&
    input.quote.freshness !== "unavailable" &&
    input.quote.freshness !== "stale" &&
    timestampIsCurrent(
      input.quote.providerTimestamp,
      nowMs,
      input.quote.freshness === "end-of-day" ? MAX_END_OF_DAY_AGE_MS : MAX_QUOTE_AGE_MS,
    ) &&
    timestampIsCurrent(input.quote.retrievedAt, nowMs, MAX_QUOTE_AGE_MS) &&
    Date.parse(input.quote.providerTimestamp) <=
      Date.parse(input.quote.retrievedAt) + FUTURE_TOLERANCE_MS
      ? pass(`Quote freshness is ${input.quote.freshness}.`)
      : fail("Quote evidence is stale, unavailable, invalid, or future-dated.");

  const financialEvidence =
    input.secFacts &&
    normalizeSymbol(input.secFacts.ticker) === symbol &&
    Number.isInteger(input.secFacts.cik) &&
    input.secFacts.cik > 0 &&
    input.secFacts.sourceUrl.startsWith("https://data.sec.gov/") &&
    Object.keys(input.secFacts.facts).length > 0 &&
    timestampIsCurrent(input.secFacts.retrievedAt, nowMs, MAX_SEC_FACT_AGE_MS) &&
    (!input.secCompany || input.secCompany.cik === input.secFacts.cik)
      ? pass(`Machine-readable SEC financial evidence explicitly matches ${symbol}.`)
      : fail("Current ticker-matched SEC financial evidence is missing, stale, or identity-mismatched.");

  const riskEvidence =
    input.riskEvidence &&
    input.riskEvidence.verified === true &&
    normalizeSymbol(input.riskEvidence.symbol) === symbol &&
    input.riskEvidence.source.trim().length > 0 &&
    timestampIsCurrent(input.riskEvidence.retrievedAt, nowMs, MAX_SEC_FACT_AGE_MS)
      ? pass("Verified current risk evidence is present.")
      : fail("Verified current machine-readable risk evidence is not connected.");

  const versionedCalculation =
    input.calculation &&
    normalizeSymbol(input.calculation.symbol) === symbol &&
    Number.isFinite(input.calculation.score) &&
    input.calculation.score >= 0 &&
    input.calculation.score <= 100 &&
    input.calculation.modelVersion.trim().length > 0 &&
    timestampIsCurrent(input.calculation.calculatedAt, nowMs, MAX_QUOTE_AGE_MS)
      ? pass(`Versioned calculation ${input.calculation.modelVersion} is present.`)
      : fail("A valid 0–100 Current Stock Rating™ tied to an explicit model version is not connected.");

  const gates = Object.freeze({
    secIdentity,
    marketQuote,
    quoteFreshness,
    financialEvidence,
    riskEvidence,
    versionedCalculation,
  });
  const ready = Object.values(gates).every((gate) => gate.ready);

  return Object.freeze({
    symbol,
    ready,
    status: ready ? "ready" : "not_yet_rated",
    score: ready && input.calculation ? input.calculation.score : null,
    modelVersion: ready && input.calculation ? input.calculation.modelVersion : null,
    gates,
  });
}
