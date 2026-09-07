// TS: 2026-09-07 02:03 ET

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
    ["src/app.ts", "src/jobs/rating-batch.ts"],
    "new production paid-history callsites require an explicit quota-guard regression before they can be added",
  );

  const ratingBatch = await readFile(new URL("../src/jobs/rating-batch.ts", import.meta.url), "utf8");
  const firstStoredSuppression = ratingBatch.indexOf("recordReusableHistorySuppression(candidate.ticker, candidate.isProtected)");
  const secPreflight = ratingBatch.indexOf("secProvider.getCompany(candidate.ticker)");
  const benchmark = ratingBatch.indexOf('getPacedHistory("SPY", 300)');
  const claim = ratingBatch.indexOf("tryClaimMarketHistoryRequest(candidate.ticker, marketProvider.name, runId)");
  const paidCandidateHistory = ratingBatch.indexOf("history = await getPacedHistory(candidate.ticker, 300)");
  const persistEvidence = ratingBatch.indexOf("saveMarketHistoryEvidence(marketHistoryEvidence)");

  assert.ok(firstStoredSuppression >= 0 && firstStoredSuppression < secPreflight, "stored suppression must remain ahead of free SEC refresh");
  assert.ok(secPreflight >= 0 && secPreflight < benchmark, "free SEC preflight must remain ahead of paid benchmark history");
  assert.ok(benchmark >= 0 && benchmark < claim, "benchmark validation must precede the candidate claim");
  assert.ok(claim >= 0 && claim < paidCandidateHistory, "candidate paid history must remain behind the atomic claim");
  assert.ok(paidCandidateHistory >= 0 && paidCandidateHistory < persistEvidence, "provider-backed market-history evidence must be persisted immediately after the paid candidate history path");

  const app = await readFile(new URL("../src/app.ts", import.meta.url), "utf8");
  const directRouteStart = app.indexOf('app.get<{ Params: SymbolParams }>("/api/ratings/:symbol"');
  const directRoute = directRouteStart >= 0 ? app.slice(directRouteStart) : "";
  const firstDirectSuppression = directRoute.indexOf("getReusableMarketHistorySuppression(symbol, provider.name)");
  const directSecPreflight = directRoute.indexOf("secProvider.getCompany(symbol)");
  const directRevenuePreflight = directRoute.indexOf("buildAnnualFinancialPeriods(secFacts)");
  const secondDirectSuppression = directRoute.indexOf(
    "getReusableMarketHistorySuppression(symbol, provider.name)",
    firstDirectSuppression + 1,
  );
  const directPaidHistory = directRoute.indexOf("provider.getDailyHistory(symbol, 300)");
  const directPersistEvidence = directRoute.indexOf("saveMarketHistoryEvidence(buildMarketHistoryEvidence(companyHistory))");

  assert.ok(directRouteStart >= 0, "direct rating route must remain present");
  assert.ok(firstDirectSuppression >= 0 && firstDirectSuppression < directSecPreflight, "direct route must reuse durable paid-history suppression before SEC network work");
  assert.ok(directSecPreflight >= 0 && directSecPreflight < directRevenuePreflight, "direct route must finish free SEC retrieval before revenue qualification");
  assert.ok(directRevenuePreflight >= 0 && directRevenuePreflight < secondDirectSuppression, "direct route must reject insufficient SEC revenue history before the last paid-call suppression recheck");
  assert.ok(secondDirectSuppression >= 0 && secondDirectSuppression < directPaidHistory, "direct route must close the suppression race immediately before paid company history");
  assert.ok(directPaidHistory >= 0 && directPaidHistory < directPersistEvidence, "direct route must persist provider-backed market-history evidence before any later eligibility return");
});
