// TS: 2026-08-09 16:58 ET

import type { SecCompanyFactsSummary } from "../sec/types.js";
import { buildAnnualFinancialPeriods } from "./financial-periods.js";
import { verifyMarketEvidence, type MarketEvidenceSource } from "./market-evidence.js";
import type { ProductionRatingInput } from "./types.js";

export interface VerifiedRiskEvidence {
  readonly verified: boolean;
  readonly checkedAt: string | null;
  readonly source: string | null;
  readonly flags: readonly string[];
}

export interface ProductionRatingAssemblySource {
  readonly symbol: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly securityType: string | null;
  readonly secIdentityResolved: boolean;
  readonly secCik: string | null;
  readonly secFacts: SecCompanyFactsSummary;
  readonly companyMarket: MarketEvidenceSource;
  readonly benchmarkMarket: MarketEvidenceSource;
  readonly benchmarkSymbol: string;
  readonly riskEvidence: VerifiedRiskEvidence;
  readonly calculatedAt: string;
}

export interface ProductionRatingAssemblyFailure {
  readonly ready: false;
  readonly status: "Data Incomplete / Not Yet Rated";
  readonly missingEvidence: readonly string[];
}

export interface ProductionRatingAssemblySuccess {
  readonly ready: true;
  readonly input: ProductionRatingInput;
}

export type ProductionRatingAssemblyResult =
  | ProductionRatingAssemblyFailure
  | ProductionRatingAssemblySuccess;

function validTimestamp(value: string | null): boolean {
  return Boolean(value && Number.isFinite(Date.parse(value)));
}

export function assembleProductionRatingInput(
  source: ProductionRatingAssemblySource,
): ProductionRatingAssemblyResult {
  const missing = new Set<string>();
  const symbol = source.symbol.trim().toUpperCase();
  const benchmarkSymbol = source.benchmarkSymbol.trim().toUpperCase();

  if (!symbol) missing.add("company symbol identity");
  if (!source.secIdentityResolved || !source.secCik?.trim()) missing.add("verified SEC company identity");
  if (!validTimestamp(source.calculatedAt)) missing.add("versioned calculation timestamp");

  const financial = buildAnnualFinancialPeriods(source.secFacts);
  if (!financial.historyAvailable || financial.periods.length < 3) {
    missing.add("verified comparable annual financial history");
  }

  const companyMarket = verifyMarketEvidence(source.companyMarket);
  if (!companyMarket.verified) {
    for (const item of companyMarket.missingEvidence) missing.add(item);
  } else if (companyMarket.evidence.symbol !== symbol) {
    missing.add("company market-data symbol match");
  }

  const benchmarkMarket = verifyMarketEvidence(source.benchmarkMarket);
  if (!benchmarkMarket.verified) {
    for (const item of benchmarkMarket.missingEvidence) missing.add(`benchmark ${item}`);
  } else if (!benchmarkSymbol || benchmarkMarket.evidence.symbol !== benchmarkSymbol) {
    missing.add("benchmark market-data symbol match");
  }

  if (
    !source.riskEvidence.verified ||
    !validTimestamp(source.riskEvidence.checkedAt) ||
    !source.riskEvidence.source?.trim()
  ) {
    missing.add("verified current risk evidence");
  }

  if (missing.size) {
    return Object.freeze({
      ready: false,
      status: "Data Incomplete / Not Yet Rated",
      missingEvidence: Object.freeze([...missing].sort()),
    });
  }

  if (!companyMarket.verified || !benchmarkMarket.verified) {
    throw new Error("Invariant violation: verified market evidence disappeared after readiness checks.");
  }

  return Object.freeze({
    ready: true,
    input: Object.freeze({
      symbol,
      companyName: source.companyName.trim(),
      exchange: source.exchange,
      securityType: source.securityType,
      secIdentityResolved: true,
      secCik: source.secCik!.trim(),
      financialPeriods: financial.periods,
      marketBars: companyMarket.evidence.bars,
      benchmarkSymbol,
      benchmarkBars: benchmarkMarket.evidence.bars,
      marketProviderName: companyMarket.evidence.providerName,
      marketProviderConfigured: true,
      calculatedAt: source.calculatedAt,
    }),
  });
}
