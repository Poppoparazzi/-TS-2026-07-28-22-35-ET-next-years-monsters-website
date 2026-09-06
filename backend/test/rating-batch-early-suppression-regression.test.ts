// TS: 2026-09-06 16:57 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");

test("durable market-history suppression is checked before SEC refresh", () => {
  const loopStart = source.indexOf("for (const candidate of candidates)");
  const firstSuppressionCheck = source.indexOf(
    "if (await recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)) continue;",
    loopStart,
  );
  const getCompany = source.indexOf("secProvider.getCompany(candidate.ticker)", loopStart);
  const getFacts = source.indexOf("secProvider.getCompanyFacts(candidate.ticker)", loopStart);
  const getFilings = source.indexOf("secProvider.getRecentFilings(candidate.ticker, 1)", loopStart);

  assert.ok(loopStart >= 0, "rating candidate loop must exist");
  assert.ok(firstSuppressionCheck > loopStart, "candidate loop must begin with a durable suppression check");
  assert.ok(firstSuppressionCheck < getCompany, "durable suppression must precede SEC company lookup");
  assert.ok(firstSuppressionCheck < getFacts, "durable suppression must precede SEC facts lookup");
  assert.ok(firstSuppressionCheck < getFilings, "durable suppression must precede SEC filings lookup");
});

test("paid-history race-closing suppression rechecks remain present", () => {
  const suppressionChecks = source.match(
    /if \(await recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)\) continue;/g,
  ) ?? [];

  assert.ok(
    suppressionChecks.length >= 4,
    `expected early, post-SEC, pre-claim, and post-claim suppression checks; found ${suppressionChecks.length}`,
  );
  assert.match(source, /beforeMarketHistoryRetryAttempt = async \(\) =>/);
  assert.match(source, /return !\(await recordReusableHistorySuppression\(candidate\.ticker, candidate\.isProtected\)\);/);
});
