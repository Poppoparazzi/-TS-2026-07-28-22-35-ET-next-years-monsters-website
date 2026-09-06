// TS: 2026-09-06 03:57 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const batchStoreUrl = new URL("../src/ratings/batch-store.ts", import.meta.url);

interface EvidenceFixture {
  readonly ticker: string;
  readonly protectedCandidate: boolean;
  readonly pilot: boolean;
  readonly freshHistory: boolean;
  readonly ratingHistoryReady: boolean | null;
  readonly historyDollarVolume: number | null;
  readonly quoteDollarVolume: number | null;
  readonly annualRevenuePeriods: number;
}

function combinedEvidenceBucket(candidate: EvidenceFixture): number {
  if (
    candidate.freshHistory
    && candidate.ratingHistoryReady === true
    && (candidate.historyDollarVolume ?? -1) >= 1_000_000
    && candidate.annualRevenuePeriods >= 2
  ) return 0;
  if ((candidate.quoteDollarVolume ?? -1) >= 1_000_000 && candidate.annualRevenuePeriods >= 2) return 1;
  if (candidate.annualRevenuePeriods >= 2) return 2;
  return 3;
}

function compareEvidencePriority(left: EvidenceFixture, right: EvidenceFixture): number {
  if (left.protectedCandidate !== right.protectedCandidate) return left.protectedCandidate ? -1 : 1;
  if (left.pilot !== right.pilot) return left.pilot ? -1 : 1;

  const bucketDelta = combinedEvidenceBucket(left) - combinedEvidenceBucket(right);
  if (bucketDelta !== 0) return bucketDelta;

  if (left.freshHistory !== right.freshHistory) return left.freshHistory ? -1 : 1;
  const leftReady = left.ratingHistoryReady === true ? 0 : left.ratingHistoryReady === null ? 1 : 2;
  const rightReady = right.ratingHistoryReady === true ? 0 : right.ratingHistoryReady === null ? 1 : 2;
  if (leftReady !== rightReady) return leftReady - rightReady;

  const historyLiquidityDelta = (right.historyDollarVolume ?? -1) - (left.historyDollarVolume ?? -1);
  if (historyLiquidityDelta !== 0) return historyLiquidityDelta;
  const quoteLiquidityDelta = (right.quoteDollarVolume ?? -1) - (left.quoteDollarVolume ?? -1);
  if (quoteLiquidityDelta !== 0) return quoteLiquidityDelta;
  const revenueDepthDelta = right.annualRevenuePeriods - left.annualRevenuePeriods;
  if (revenueDepthDelta !== 0) return revenueDepthDelta;
  return left.ticker.localeCompare(right.ticker);
}

test("paid-history queue prioritizes candidates with both verified liquidity and multi-year revenue evidence", async () => {
  const source = await readFile(batchStoreUrl, "utf8");
  const orderByStart = source.indexOf("ORDER BY CASE WHEN ${PROTECTED_COMPANY_SQL_PREDICATE}");
  const orderByEnd = source.indexOf("LIMIT $1", orderByStart);
  assert.notEqual(orderByStart, -1);
  assert.notEqual(orderByEnd, -1);

  const ordering = source.slice(orderByStart, orderByEnd);
  const combinedBucket = ordering.indexOf("history_readiness.rating_history_ready = true");
  const historyLiquidity = ordering.indexOf("history_readiness.twenty_session_average_dollar_volume >= 1000000", combinedBucket);
  const multiYearRevenue = ordering.indexOf("COALESCE(revenue_depth.annual_revenue_period_count, 0) >= 2 THEN 0", historyLiquidity);
  const quoteFallback = ordering.indexOf("stored_liquidity.dollar_volume >= 1000000", multiYearRevenue);
  const weakerHistoryOrdering = ordering.indexOf("WHEN history_readiness.retrieved_at IS NULL THEN 1", quoteFallback);

  assert.ok(combinedBucket >= 0, "combined priority bucket must require rating-ready stored history");
  assert.ok(historyLiquidity > combinedBucket, "combined priority bucket must require verified 20-session liquidity");
  assert.ok(multiYearRevenue > historyLiquidity, "combined priority bucket must also require at least two annual revenue periods");
  assert.ok(quoteFallback > multiYearRevenue, "fresh quote liquidity plus revenue depth must remain a fallback behind provider-backed history liquidity");
  assert.ok(weakerHistoryOrdering > quoteFallback, "combined evidence buckets must be evaluated before weaker individual tie-breakers");
});

test("combined-evidence policy orders otherwise comparable candidates before scarce paid history calls", () => {
  const candidates: EvidenceFixture[] = [
    {
      ticker: "REVENUE_ONLY",
      protectedCandidate: false,
      pilot: false,
      freshHistory: false,
      ratingHistoryReady: null,
      historyDollarVolume: null,
      quoteDollarVolume: null,
      annualRevenuePeriods: 4,
    },
    {
      ticker: "QUOTE_AND_REVENUE",
      protectedCandidate: false,
      pilot: false,
      freshHistory: false,
      ratingHistoryReady: null,
      historyDollarVolume: null,
      quoteDollarVolume: 1_500_000,
      annualRevenuePeriods: 2,
    },
    {
      ticker: "HISTORY_AND_REVENUE",
      protectedCandidate: false,
      pilot: false,
      freshHistory: true,
      ratingHistoryReady: true,
      historyDollarVolume: 1_250_000,
      quoteDollarVolume: null,
      annualRevenuePeriods: 2,
    },
    {
      ticker: "WEAK_EVIDENCE",
      protectedCandidate: false,
      pilot: false,
      freshHistory: false,
      ratingHistoryReady: null,
      historyDollarVolume: null,
      quoteDollarVolume: 900_000,
      annualRevenuePeriods: 1,
    },
  ];

  const ordered = [...candidates].sort(compareEvidencePriority).map((candidate) => candidate.ticker);
  assert.deepEqual(ordered, [
    "HISTORY_AND_REVENUE",
    "QUOTE_AND_REVENUE",
    "REVENUE_ONLY",
    "WEAK_EVIDENCE",
  ]);
});

test("protected and pilot policy remains ahead of evidence-bucket ordering", () => {
  const candidates: EvidenceFixture[] = [
    {
      ticker: "STRONG_NORMAL",
      protectedCandidate: false,
      pilot: false,
      freshHistory: true,
      ratingHistoryReady: true,
      historyDollarVolume: 5_000_000,
      quoteDollarVolume: 5_000_000,
      annualRevenuePeriods: 5,
    },
    {
      ticker: "PILOT",
      protectedCandidate: false,
      pilot: true,
      freshHistory: false,
      ratingHistoryReady: null,
      historyDollarVolume: null,
      quoteDollarVolume: null,
      annualRevenuePeriods: 1,
    },
    {
      ticker: "PROTECTED",
      protectedCandidate: true,
      pilot: false,
      freshHistory: false,
      ratingHistoryReady: null,
      historyDollarVolume: null,
      quoteDollarVolume: null,
      annualRevenuePeriods: 1,
    },
  ];

  const ordered = [...candidates].sort(compareEvidencePriority).map((candidate) => candidate.ticker);
  assert.deepEqual(ordered, ["PROTECTED", "PILOT", "STRONG_NORMAL"]);
});
