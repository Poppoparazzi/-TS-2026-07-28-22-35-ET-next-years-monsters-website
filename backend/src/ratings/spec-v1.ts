// TS: 2026-08-05 07:18 ET

import type { RatingComponentKey, RatingTier } from "./types.js";

export const MONSTER_RATING_ENGINE_VERSION = "nym-rating-v1.0.0";
export const MINIMUM_FINANCIAL_PERIODS = 2;
export const MINIMUM_MARKET_BARS = 126;
export const MAXIMUM_MARKET_DATA_AGE_DAYS = 7;
export const MINIMUM_AVERAGE_DOLLAR_VOLUME_20D = 500_000;
export const MINIMUM_DATA_COMPLETENESS_SCORE = 70;

export interface RatingComponentSpecification {
  readonly key: RatingComponentKey;
  readonly label: string;
  readonly weight: number;
}

export const RATING_COMPONENT_SPECIFICATIONS: readonly RatingComponentSpecification[] =
  Object.freeze([
    { key: "monster_dna", label: "Monster DNA™", weight: 0.1 },
    { key: "tipping_point", label: "Tipping Point™", weight: 0.1 },
    { key: "market_weather", label: "Market Weather™", weight: 0.06 },
    { key: "move_driver", label: "Move Driver™", weight: 0.08 },
    { key: "monster_climb", label: "Monster Climb™", weight: 0.1 },
    { key: "business_quality", label: "Business Quality", weight: 0.1 },
    { key: "growth_acceleration", label: "Growth and Acceleration", weight: 0.1 },
    {
      key: "earnings_revenue_evidence",
      label: "Earnings and Revenue Evidence",
      weight: 0.08,
    },
    {
      key: "price_volume_leadership",
      label: "Price and Volume Leadership",
      weight: 0.08,
    },
    { key: "relative_strength", label: "Relative Strength", weight: 0.06 },
    {
      key: "liquidity_tradability",
      label: "Liquidity and Tradability",
      weight: 0.05,
    },
    {
      key: "risk_deterioration",
      label: "Risk and Deterioration Signals",
      weight: 0.05,
    },
    {
      key: "data_freshness_completeness",
      label: "Data Freshness and Completeness",
      weight: 0.04,
    },
  ]);

const weightTotal = RATING_COMPONENT_SPECIFICATIONS.reduce(
  (sum, component) => sum + component.weight,
  0,
);

if (Math.abs(weightTotal - 1) > 0.000_001) {
  throw new Error(`Monster Rating component weights must total 1. Received ${weightTotal}.`);
}

export function ratingTier(score: number): RatingTier {
  if (score >= 92) return "Platinum";
  if (score >= 85) return "Gold";
  if (score >= 75) return "Silver";
  if (score >= 65) return "Bronze";
  if (score >= 50) return "Goblin";
  return "Cemetery Risk";
}

export function tierExplanation(tier: RatingTier): string {
  switch (tier) {
    case "Platinum":
      return "Exceptionally strong verified evidence across growth, quality, leadership, and risk controls.";
    case "Gold":
      return "Strong verified evidence with fewer material weaknesses than the broader eligible universe.";
    case "Silver":
      return "Constructive evidence with meaningful strengths and identifiable limitations.";
    case "Bronze":
      return "Mixed evidence that merits monitoring rather than automatic enthusiasm.";
    case "Goblin":
      return "Weak or inconsistent evidence with substantial execution, market, or data risks.";
    case "Cemetery Risk":
      return "Severe deterioration, weak evidence, or risk signals dominate the current calculation.";
  }
}
