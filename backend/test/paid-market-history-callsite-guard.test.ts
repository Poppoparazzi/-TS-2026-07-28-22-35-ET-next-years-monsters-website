// TS: 2026-09-14 05:08 UTC

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import test from "node:test";

const srcRoot = new URL("../src/", import.meta.url);

async function listTypeScriptFiles(directory: URL): Promise<readonly URL[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    if (entry.isDirectory()) return listTypeScriptFiles(url);
    return extname(entry.name) === ".ts" ? [url] : [];
  }));
  return nested.flat();
}

test("all paid daily-history production callsites stay behind free preflight and durable suppression guards", async () => {
  const files = await listTypeScriptFiles(srcRoot);
  const directCallsites: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!/\.getDailyHistory!?\s*\(/.test(source)) continue;
    directCallsites.push(relative(new URL("..", srcRoot).pathname, file.pathname));
  }

  assert.deepEqual(
    directCallsites.sort(),
    ["src/app.ts", "src/jobs/rating-batch.ts", "src/ratings/direct-company-history.ts"],
    "new production paid-history callsites require an explicit quota-guard regression before they can be added",
  );

  const ratingBatch = await readFile(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");
  const firstStoredSuppression = ratingBatch.indexOf("recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)");
  const secPreflight = ratingBatch.indexOf("secProvider.getCompany(candidate.ticker)");
  const claim = ratingBatch.indexOf("tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)");
  const paidCandidateHistory = ratingBatch.indexOf("history = await getPacedHistory(candidate.ticker, 300)");
  const persistEvidence = ratingBatch.indexOf("saveMarketHistoryEvidence(marketHistoryEvidence)");
  const evidenceSuppressionGate = ratingBatch.indexOf("if (marketHistoryEvidence.suppressionReason)");
  const benchmark = ratingBatch.indexOf('getPacedHistory("SPY", 300)');
  const benchmarkValidation = ratingBatch.indexOf("validateBenchmarkHistory(benchmarkHistory)");

  assert.ok(firstStoredSuppression >= 0 && firstStoredSuppression < secPreflight, "stored suppression must remain ahead of free SEC refresh");
  assert.ok(secPreflight >= 0 && secPreflight < claim, "free SEC preflight must remain ahead of the atomic paid-history claim");
  assert.ok(claim >= 0 && claim < paidCandidateHistory, "candidate paid history must remain behind the atomic claim");
  assert.ok(paidCandidateHistory >= 0 && paidCandidateHistory < persistEvidence, "provider-backed market-history evidence must be persisted immediately after the paid candidate history path");
  assert.ok(persistEvidence >= 0 && persistEvidence < evidenceSuppressionGate, "candidate market-history evidence must be persisted before an early suppression return");
  assert.ok(evidenceSuppressionGate >= 0 && evidenceSuppressionGate < benchmark, "suppressed candidates must not spend quota on shared benchmark history");
  assert.ok(benchmark >= 0 && benchmark < benchmarkValidation, "shared benchmark history must be validated after the surviving candidate reaches it");

  const directHistory = await readFile(new URL("../src/ratings/direct-company-history.ts", import.meta.url), "utf8");
  const leaseLoaderStart = directHistory.indexOf("export async function loadDirectCompanyHistoryWithLease");
  const leaseLoader = leaseLoaderStart >= 0 ? directHistory.slice(leaseLoaderStart) : "";
  const directHistoryCachePreflight = leaseLoader.indexOf("inspectCachedCompanyHistory(");
  const directHistoryClaim = leaseLoader.indexOf("tryClaimMarketHistoryRequest(");
  const directHistoryPostClaimSuppression = leaseLoader.indexOf("getReusableMarketHistorySuppression(");
  const directHistoryPaidCall = leaseLoader.indexOf("input.marketProvider.getDailyHistory(input.ticker, 300)");
  const directHistoryPersist = leaseLoader.indexOf("saveMarketHistoryEvidence(");

  assert.ok(leaseLoaderStart >= 0, "lease-safe direct-history helper must remain present");
  assert.ok(directHistoryCachePreflight >= 0 && directHistoryCachePreflight < directHistoryClaim, "direct-history helper must inspect free cached evidence before claiming paid quota");
  assert.ok(directHistoryClaim >= 0 && directHistoryClaim < directHistoryPostClaimSuppression, "direct-history helper must acquire the paid-history lease before its race-closing suppression recheck");
  assert.ok(directHistoryPostClaimSuppression >= 0 && directHistoryPostClaimSuppression < directHistoryPaidCall, "direct-history helper must close the suppression race before the paid provider call");
  assert.ok(directHistoryPaidCall >= 0 && directHistoryPaidCall < directHistoryPersist, "direct-history helper must persist provider-backed evidence immediately after the paid provider call");

  const app = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
  const directRouteStart = app.indexOf('app.get<{ Params: SymbolParams }>("/api/ratings/:symbol"');
  const directRoute = directRouteStart >= 0 ? app.slice(directRouteStart) : "";
  const firstDirectSuppression = directRoute.indexOf("getReusableMarketHistorySuppression(symbol, provider.name)");
  const directSecPreflight = directRoute.indexOf("secProvider.getCompany(symbol)");
  const directRevenuePreflight = directRoute.indexOf("buildAnnualFinancialPeriods(secFacts)");
  const directSecurityTypePreflight = directRoute.indexOf("getSecFundSecurityTypeEvidence(symbol)");
  const secondDirectSuppression = directRoute.indexOf(
    "getReusableMarketHistorySuppression(symbol, provider.name)",
    firstDirectSuppression + 1,
  );
  const directHistoryLoader = directRoute.indexOf("loadDirectCompanyHistoryWithLease({");
  const directReadyHistory = directRoute.indexOf("const companyHistory = directHistoryResult.history");
  const directBenchmarkHistory = directRoute.indexOf('provider.getDailyHistory("SPY", 300)');
  const directRelease = directRoute.indexOf("releaseMarketHistoryRequestClaim(", directHistoryLoader);

  assert.ok(directRouteStart >= 0, "direct rating route must remain present");
  assert.ok(firstDirectSuppression >= 0 && firstDirectSuppression < directSecPreflight, "direct route must reuse durable paid-history suppression before SEC network work");
  assert.ok(directSecPreflight >= 0 && directSecPreflight < directRevenuePreflight, "direct route must finish free SEC retrieval before revenue qualification");
  assert.ok(directRevenuePreflight >= 0 && directRevenuePreflight < directSecurityTypePreflight, "direct route must reject insufficient SEC revenue history before authoritative security-type classification");
  assert.ok(directSecurityTypePreflight >= 0 && directSecurityTypePreflight < secondDirectSuppression, "direct route must complete authoritative SEC fund/security-type preflight before its last paid-call suppression recheck");
  assert.ok(secondDirectSuppression >= 0 && secondDirectSuppression < directHistoryLoader, "direct route must recheck durable suppression before invoking the lease-safe history loader");
  assert.ok(directHistoryLoader >= 0 && directHistoryLoader < directReadyHistory, "direct route must obtain company history through the lease-safe helper before rating work");
  assert.ok(directReadyHistory >= 0 && directReadyHistory < directBenchmarkHistory, "direct route must resolve a ready company-history result before spending quota on SPY benchmark history");
  assert.equal(directRoute.indexOf("provider.getDailyHistory(symbol, 300)"), -1, "direct route must not bypass the lease-safe helper with a company-history provider call");
  assert.equal(directRoute.indexOf("buildMarketHistoryEvidence(companyHistory)"), -1, "direct route must not duplicate market-history evidence construction owned by the helper");
  assert.equal(directRoute.indexOf("saveMarketHistoryEvidence(marketHistoryEvidence)"), -1, "direct route must not duplicate evidence persistence owned by the helper");
  assert.ok(directRelease > directHistoryLoader, "direct route must release a helper-acquired ticker lease after downstream rating work");
  assert.match(directRoute, /finally\s*\{[\s\S]*releaseMarketHistoryRequestClaim\(/, "direct route must release a helper-acquired ticker lease even when downstream work throws or returns early");
});
