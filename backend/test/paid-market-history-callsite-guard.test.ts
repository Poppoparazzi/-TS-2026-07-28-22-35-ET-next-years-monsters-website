// TS: 2026-09-07 02:03 ET

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
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

test("paid daily-history provider calls stay centralized behind rating-batch quota guards", async () => {
  const files = await listTypeScriptFiles(srcRoot);
  const directCallsites: string[] = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (!/\.getDailyHistory!?\s*\(/.test(source)) continue;
    directCallsites.push(relative(new URL("..", srcRoot).pathname, file.pathname));
  }

  assert.deepEqual(
    directCallsites.sort(),
    ["src/jobs/rating-batch.ts"],
    "production code must not add a direct paid daily-history call outside rating-batch; route new history work through its persisted suppression, atomic-claim, pacing, and retry guards",
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
});
