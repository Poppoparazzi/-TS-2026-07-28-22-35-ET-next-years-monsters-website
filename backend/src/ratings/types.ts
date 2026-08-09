// TS: 2026-08-09 12:01 ET

export type RatingTier =
  | "Platinum"
  | "Gold"
  | "Silver"
  | "Bronze"
  | "Goblin"
  | "Cemetery Risk"
  | "Tier Boundary Unresolved";

export type RatingEligibilityCode =
  | "eligible"
  | "unresolved_sec_identity"
  | "provider_not_connected"
  | "unsupported_security_type"
  | "insufficient_financial_history"
  | "insufficient_market_history"
  | "stale_market_data"
  | "insufficient_liquidity"
  | "incomplete_evidence";

export type RatingComponentKey =
  | "monster_dna"
  | "tipping_point"
  | "market_weather"
  | "move_driver"
  | "monster_climb"
  | "business_quality"
  | "growth_acceleration"
  | "earnings_revenue_evidence"
  | "price_volume_leadership"
  | "relative_strength"
  | "liquidity_tradability"
  | "risk_deterioration"
  | "data_freshness_completeness";

export interface FinancialPeriodEvidence {
  readonly periodEnd: string;
  readonly fiscalYear: number | null;
  readonly fiscalPeriod: string | null;
  readonly form: string;
  readonly filedAt: string;
  readonly revenue: number | null;
  readonly grossProfit: number | null;
  readonly operatingIncome: number | null;
  readonly netIncome: number | null;
  readonly dilutedEps: number | null;
  readonly assets: number | null;
  readonly liabilities: number | null;
  readonly shareholdersEquity: number | null;
  readonly cash: number | null;
  readonly operatingCashFlow: number | null;
  readonly sourceUrl: string;
}

export interface MarketBarEvidence {
  readonly date: string;
  readonly close: number;
  readonly volume: number;
}

export interface ProductionRatingInput {
  readonly symbol: string;
  readonly companyName: string;
  readonly exchange: string | null;
  readonly securityType: string | null;
  readonly secIdentityResolved: boolean;
  readonly secCik: string | null;
  readonly financialPeriods: readonly FinancialPeriodEvidence[];
  readonly marketBars: readonly MarketBarEvidence[];
  readonly benchmarkSymbol: string;
  readonly benchmarkBars: readonly MarketBarEvidence[];
  readonly marketProviderName: string | null;
  readonly marketProviderConfigured: boolean;
  readonly calculatedAt: string;
}

export interface RatingEvidenceValue {
  readonly key: string;
  readonly label: string;
  readonly value: number | string | boolean | null;
  readonly unit: string | null;
  readonly sourceType: "sec-filing" | "company-fact" | "market-data" | "derived";
  readonly sourceTimestamp: string | null;
  readonly sourceUrl: string | null;
}

export interface RatingComponentResult {
  readonly key: RatingComponentKey;
  readonly label: string;
  readonly score: number;
  readonly weight: number;
  readonly weightedScore: number;
  readonly direction: "positive" | "negative" | "neutral" | "unavailable";
  readonly explanation: string;
  readonly evidence: readonly RatingEvidenceValue[];
}

export interface RatingEligibilityReason {
  readonly code: Exclude<RatingEligibilityCode, "eligible">;
  readonly message: string;
  readonly retryable: boolean;
  readonly missingEvidence: readonly string[];
}

export interface RatingReasonDetail {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly missingEvidence: readonly string[];
}

interface RatingResultBase {
  readonly symbol: string;
  readonly companyName: string;
  readonly engineVersion: string;
  readonly calculatedAt: string;
  readonly dataAsOf: string | null;
  readonly dataCompletenessScore: number;
  readonly evidenceInputs: readonly RatingEvidenceValue[];
}

export interface EligibleProductionRating extends RatingResultBase {
  readonly eligible: true;
  readonly eligibilityCode: "eligible";
  readonly score: number;
  readonly tier: RatingTier;
  readonly confidence: "high" | "medium" | "low";
  readonly components: readonly RatingComponentResult[];
  readonly positiveDrivers: readonly string[];
  readonly negativeDrivers: readonly string[];
  readonly summary: string;
  readonly risks: string;
}

export interface IneligibleProductionRating extends RatingResultBase {
  readonly eligible: false;
  readonly eligibilityCode: Exclude<RatingEligibilityCode, "eligible">;
  readonly score: null;
  readonly tier: null;
  readonly confidence: "unavailable";
  readonly components: readonly RatingComponentResult[];
  readonly reasons: readonly RatingReasonDetail[];
  readonly summary: "Not Yet Rated" | "Unresolved SEC Identity" | "Provider Not Connected";
}

export type ProductionRatingResult = EligibleProductionRating | IneligibleProductionRating;
