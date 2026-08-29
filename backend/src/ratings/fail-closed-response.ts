// TS: 2026-08-29 08:38 ET

export interface RatingEvidenceFailure {
  readonly code: string;
  readonly message: string;
}

export interface FailClosedRatingResponse {
  readonly symbol: string;
  readonly engineVersion: "nym-current-stock-rating-v0.1-readiness-only";
  readonly calculatedAt: string;
  readonly eligible: false;
  readonly score: null;
  readonly tier: "NOT YET RATED";
  readonly eligibilityCode: "required_evidence_incomplete";
  readonly summary: string;
  readonly evidenceInputs: readonly unknown[];
  readonly components: readonly {
    readonly key: "risk_deterioration";
    readonly label: "Risk deterioration";
    readonly direction: "unavailable";
    readonly score: null;
    readonly sourceUrl: null;
    readonly sourceTimestamp: null;
  }[];
  readonly reasons: readonly RatingEvidenceFailure[];
  readonly rollout: {
    readonly cohort: "top_500";
    readonly status: "rating_in_progress";
    readonly message: "Not Yet Rated — Insufficient Evidence for Prediction.";
  };
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function buildFailClosedRatingResponse(
  symbol: string,
  calculatedAt: string,
  reasons: readonly RatingEvidenceFailure[],
): FailClosedRatingResponse {
  const safeReasons = reasons.length > 0
    ? reasons
    : [
        {
          code: "required_evidence_incomplete",
          message: "Required production evidence is incomplete or cannot yet be verified.",
        },
      ];

  return Object.freeze({
    symbol: normalizeSymbol(symbol),
    engineVersion: "nym-current-stock-rating-v0.1-readiness-only",
    calculatedAt,
    eligible: false,
    score: null,
    tier: "NOT YET RATED",
    eligibilityCode: "required_evidence_incomplete",
    summary: "Not Yet Rated — Insufficient Evidence for Prediction. A numeric Monster Rating™ is withheld until the required evidence can be verified.",
    evidenceInputs: Object.freeze([]),
    components: Object.freeze([
      Object.freeze({
        key: "risk_deterioration",
        label: "Risk deterioration",
        direction: "unavailable",
        score: null,
        sourceUrl: null,
        sourceTimestamp: null,
      }),
    ]),
    reasons: Object.freeze([...safeReasons]),
    rollout: Object.freeze({
      cohort: "top_500",
      status: "rating_in_progress",
      message: "Not Yet Rated — Insufficient Evidence for Prediction.",
    }),
  });
}
