// TS: 2026-08-19 10:00 ET

import assert from "node:assert/strict";
import test from "node:test";
import { shouldSkipSecBackfill } from "../src/jobs/startup-sec-universe-batch.js";
import type {
  UniverseCompanyStatus,
  UniverseStatusSummary,
} from "../src/universe/types.js";

function company(
  ticker: string,
  isPilot: boolean,
  secStage: UniverseCompanyStatus["secStage"],
): UniverseCompanyStatus {
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
    lastCompletedAt: secStage === "complete" ? "2026-08-19T13:00:00.000Z" : null,
    nextRetryAt: null,
    hasSecIdentity: secStage === "complete",
    hasFilings: secStage === "complete",
    hasFacts: secStage === "complete",
    hasQuote: false,
    hasRating: false,
    updatedAt: "2026-08-19T13:00:00.000Z",
  });
}

function status(
  companies: readonly UniverseCompanyStatus[],
  overrides: Partial<UniverseStatusSummary> = {},
): UniverseStatusSummary {
  return Object.freeze({
    configured: true,
    generatedAt: "2026-08-19T14:00:00.000Z",
    requestedLimit: 5_000,
    universeSize: 5_000,
    examinedCount: 5_000,
    queuedCount: 0,
    processingCount: 0,
    secCompleteCount: 2_000,
    partialCount: 0,
    failedCount: 0,
    staleCount: 0,
    unresolvedCount: 3_000,
    secIdentityCount: 2_000,
    filingCompleteCount: 2_000,
    factsCompleteCount: 2_000,
    quoteCompleteCount: 0,
    ratingCompleteCount: 0,
    fullyCompleteCount: 0,
    incompleteCount: 3_000,
    companies,
    ...overrides,
  });
}

test("SEC backfill stops only after the usable target, zero failures, and all protected pilots are complete", () => {
  const completePilots = status([
    company("AAPL", true, "complete"),
    company("NVDA", true, "complete"),
    company("LOWPRI", false, "unresolved"),
  ]);

  assert.equal(shouldSkipSecBackfill(completePilots, 2_000), true);
  assert.equal(
    shouldSkipSecBackfill(
      status([
        company("AAPL", true, "complete"),
        company("NVDA", true, "unresolved"),
      ]),
      2_000,
    ),
    false,
  );
  assert.equal(
    shouldSkipSecBackfill(completePilots, 2_001),
    false,
  );
  assert.equal(
    shouldSkipSecBackfill(status(completePilots.companies, { failedCount: 1 }), 2_000),
    false,
  );
});
