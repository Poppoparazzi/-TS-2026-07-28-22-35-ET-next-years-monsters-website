// TS: 2026-08-19 14:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import { shouldSkipSecBackfill } from "../src/jobs/startup-sec-universe-batch.js";
import type {
  PipelineStatus,
  UniverseCompanyStatus,
  UniverseStatusSummary,
} from "../src/universe/types.js";

function company(ticker: string, secStage: PipelineStatus, isPilot = false): UniverseCompanyStatus {
  return Object.freeze({
    ticker,
    companyName: `${ticker} Test Company`,
    exchange: "NASDAQ",
    secCik: secStage === "complete" ? "0000000001" : null,
    isPilot,
    secStage,
    secAttemptCount: 1,
    lastError: null,
    lastStartedAt: null,
    lastCompletedAt: null,
    nextRetryAt: null,
    hasSecIdentity: secStage === "complete",
    hasFilings: secStage === "complete",
    hasFacts: secStage === "complete",
    hasQuote: false,
    hasRating: false,
    updatedAt: "2026-08-19T18:01:00.000Z",
  });
}

function status(
  secCompleteCount: number,
  failedCount: number,
  companies: readonly UniverseCompanyStatus[],
): UniverseStatusSummary {
  const examinedCount = secCompleteCount + failedCount;
  return Object.freeze({
    configured: true,
    generatedAt: "2026-08-19T18:01:00.000Z",
    requestedLimit: 5_000,
    universeSize: 5_000,
    examinedCount,
    queuedCount: 0,
    processingCount: 0,
    secCompleteCount,
    partialCount: 0,
    failedCount,
    staleCount: 0,
    unresolvedCount: 0,
    secIdentityCount: secCompleteCount,
    filingCompleteCount: secCompleteCount,
    factsCompleteCount: secCompleteCount,
    quoteCompleteCount: 0,
    ratingCompleteCount: 0,
    fullyCompleteCount: 0,
    incompleteCount: failedCount,
    companies: Object.freeze([...companies]),
  });
}

test("SEC reserve backfill does not stop below the 2200 usable-stock target", () => {
  const snapshot = status(2_199, 0, [company("AAPL", "complete", true)]);
  assert.equal(shouldSkipSecBackfill(snapshot, 2_200), false);
});

test("SEC reserve backfill may stop once 2200 usable stocks are complete with no failures and protected pilots complete", () => {
  const snapshot = status(2_200, 0, [
    company("AAPL", "complete", true),
    company("NVDA", "complete", true),
    company("MNST", "complete", true),
  ]);
  assert.equal(shouldSkipSecBackfill(snapshot, 2_200), true);
});

test("SEC reserve backfill keeps running above target while any failed SEC record remains", () => {
  const snapshot = status(2_350, 1, [company("AAPL", "complete", true)]);
  assert.equal(shouldSkipSecBackfill(snapshot, 2_200), false);
});

test("SEC reserve backfill keeps running above target while a protected pilot is incomplete", () => {
  const snapshot = status(2_350, 0, [
    company("AAPL", "complete", true),
    company("NVDA", "unresolved", true),
  ]);
  assert.equal(shouldSkipSecBackfill(snapshot, 2_200), false);
});
