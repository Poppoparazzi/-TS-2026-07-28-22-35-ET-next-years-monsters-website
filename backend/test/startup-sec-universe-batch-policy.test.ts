// TS: 2026-08-21 07:01 ET

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
    lastCompletedAt: secStage === "complete" ? "2026-08-21T10:00:00.000Z" : null,
    nextRetryAt: null,
    hasSecIdentity: secStage === "complete",
    hasFilings: secStage === "complete",
    hasFacts: secStage === "complete",
    hasQuote: false,
    hasRating: false,
    updatedAt: "2026-08-21T10:00:00.000Z",
  });
}

function status(
  companies: readonly UniverseCompanyStatus[],
  overrides: Partial<UniverseStatusSummary> = {},
): UniverseStatusSummary {
  return Object.freeze({
    configured: true,
    generatedAt: "2026-08-21T11:00:00.000Z",
    requestedLimit: 5_000,
    universeSize: 5_000,
    examinedCount: 5_000,
    queuedCount: 0,
    processingCount: 0,
    secCompleteCount: 2_200,
    secEvidenceReadyCount: 2_200,
    partialCount: 0,
    failedCount: 0,
    staleCount: 0,
    unresolvedCount: 2_800,
    secIdentityCount: 2_200,
    filingCompleteCount: 2_200,
    factsCompleteCount: 2_200,
    quoteCompleteCount: 0,
    ratingCompleteCount: 0,
    fullyCompleteCount: 0,
    incompleteCount: 2_800,
    companies,
    ...overrides,
  });
}

test("SEC backfill stops only after the 2200 evidence-ready target, zero failures, and all protected stocks are complete", () => {
  const completeProtected = status([
    company("AAPL", true, "complete"),
    company("NVDA", true, "complete"),
    company("MNST", false, "complete"),
    company("LOWPRI", false, "unresolved"),
  ]);

  assert.equal(shouldSkipSecBackfill(completeProtected, 2_200), true);

  assert.equal(
    shouldSkipSecBackfill(
      status([
        company("AAPL", true, "complete"),
        company("NVDA", true, "unresolved"),
        company("MNST", false, "complete"),
      ]),
      2_200,
    ),
    false,
    "incomplete pilot stock must keep backfill running",
  );

  assert.equal(
    shouldSkipSecBackfill(
      status([
        company("AAPL", true, "complete"),
        company("NVDA", true, "complete"),
        company("MNST", false, "unresolved"),
      ]),
      2_200,
    ),
    false,
    "incomplete strategic non-pilot stock must keep backfill running",
  );

  assert.equal(
    shouldSkipSecBackfill(
      status(completeProtected.companies, {
        secCompleteCount: 2_199,
        secEvidenceReadyCount: 2_199,
        secIdentityCount: 2_199,
        filingCompleteCount: 2_199,
        factsCompleteCount: 2_199,
      }),
      2_200,
    ),
    false,
    "2199 evidence-ready stocks must not satisfy the 2200 target",
  );

  assert.equal(
    shouldSkipSecBackfill(status(completeProtected.companies, { failedCount: 1 }), 2_200),
    false,
    "remaining failed SEC records must keep cleanup running",
  );
});
