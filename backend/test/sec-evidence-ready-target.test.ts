// TS: 2026-08-21 07:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  secEvidenceReadyCount,
  shouldSkipSecBackfill,
} from "../src/jobs/startup-sec-universe-batch.js";
import type {
  UniverseCompanyStatus,
  UniverseStatusSummary,
} from "../src/universe/types.js";

function company(overrides: Partial<UniverseCompanyStatus> = {}): UniverseCompanyStatus {
  return Object.freeze({
    ticker: "TEST",
    companyName: "Test Company",
    exchange: "NASDAQ",
    secCik: "0000000001",
    isPilot: false,
    secStage: "complete",
    secAttemptCount: 1,
    lastError: null,
    lastStartedAt: "2026-08-21T10:00:00.000Z",
    lastCompletedAt: "2026-08-21T10:01:00.000Z",
    nextRetryAt: null,
    hasSecIdentity: true,
    hasFilings: true,
    hasFacts: true,
    hasQuote: false,
    hasRating: false,
    updatedAt: "2026-08-21T10:01:00.000Z",
    ...overrides,
  });
}

function status(companies: readonly UniverseCompanyStatus[], failedCount = 0): UniverseStatusSummary {
  const secCompleteCount = companies.filter((item) => item.secStage === "complete").length;
  const evidenceReadyCount = companies.filter(
    (item) =>
      item.secStage === "complete" &&
      item.hasSecIdentity &&
      item.hasFilings &&
      item.hasFacts,
  ).length;

  return Object.freeze({
    configured: true,
    generatedAt: "2026-08-21T11:00:00.000Z",
    requestedLimit: 5_000,
    universeSize: companies.length,
    examinedCount: companies.length,
    queuedCount: 0,
    processingCount: 0,
    secCompleteCount,
    secEvidenceReadyCount: evidenceReadyCount,
    partialCount: 0,
    failedCount,
    staleCount: 0,
    unresolvedCount: 0,
    secIdentityCount: companies.filter((item) => item.hasSecIdentity).length,
    filingCompleteCount: companies.filter((item) => item.hasFilings).length,
    factsCompleteCount: companies.filter((item) => item.hasFacts).length,
    quoteCompleteCount: 0,
    ratingCompleteCount: 0,
    fullyCompleteCount: 0,
    incompleteCount: companies.length,
    companies: Object.freeze([...companies]),
  });
}

test("SEC reserve target counts only evidence-ready companies as usable", () => {
  const companies = [
    company({ ticker: "AAPL", isPilot: true }),
    company({ ticker: "NVDA", isPilot: true }),
    company({ ticker: "NOFACTS", hasFacts: false }),
    company({ ticker: "NOFILINGS", hasFilings: false }),
  ];
  const snapshot = status(companies);

  assert.equal(snapshot.secCompleteCount, 4);
  assert.equal(snapshot.secEvidenceReadyCount, 2);
  assert.equal(secEvidenceReadyCount(snapshot), 2);
  assert.equal(shouldSkipSecBackfill(snapshot, 4), false);
  assert.equal(shouldSkipSecBackfill(snapshot, 2), true);
});

test("incomplete protected pilot blocks completion even when broad evidence target is met", () => {
  const companies = [
    company({ ticker: "AAPL", isPilot: true }),
    company({ ticker: "NVDA", isPilot: true, hasFacts: false }),
    company({ ticker: "MSFT" }),
  ];
  const snapshot = status(companies);

  assert.equal(secEvidenceReadyCount(snapshot), 2);
  assert.equal(shouldSkipSecBackfill(snapshot, 2), false);
});

test("remaining failed SEC rows still block completion", () => {
  const companies = [company({ ticker: "AAPL", isPilot: true }), company({ ticker: "MSFT" })];
  const snapshot = status(companies, 1);

  assert.equal(secEvidenceReadyCount(snapshot), 2);
  assert.equal(shouldSkipSecBackfill(snapshot, 2), false);
});
