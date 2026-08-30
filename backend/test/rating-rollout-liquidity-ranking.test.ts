// TS: 2026-08-30 12:14 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

function readRolloutWorker(): string {
  return readFileSync(
    new URL("../../.github/workflows/rating-rollout-worker.yml", import.meta.url),
    "utf8",
  );
}

function extractFunction(source: string, functionName: string): string {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `expected ${functionName} in rollout worker`);
  const bodyStart = source.indexOf("{", start);
  assert.notEqual(bodyStart, -1, `expected ${functionName} function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unterminated ${functionName} function body`);
}

interface WorkerLiquidityResult {
  readonly storedDollarVolume: number | null;
  readonly storedLiquidityFresh: boolean;
}

interface WorkerPreflightItem {
  readonly company: { readonly ticker: string };
  readonly filingCount: number;
  readonly factCount: number;
  readonly ratingCount: number;
  readonly storedDollarVolume: number | null;
  readonly storedLiquidityFresh: boolean;
}

function loadWorkerLiquidityPolicy(rolloutWorker: string): {
  evaluateStoredLiquidity: (quote: Record<string, unknown>, nowMs?: number) => WorkerLiquidityResult;
  compareStoredPreflightPriority: (left: WorkerPreflightItem, right: WorkerPreflightItem) => number;
} {
  const maxStoredLiquidityAgeMs = 24 * 60 * 60 * 1000;
  const futureToleranceMs = 5 * 60 * 1000;
  const source = [
    extractFunction(rolloutWorker, "evaluateStoredLiquidity"),
    extractFunction(rolloutWorker, "compareStoredPreflightPriority"),
    "({ evaluateStoredLiquidity, compareStoredPreflightPriority })",
  ].join("\n");
  return runInNewContext(source, { maxStoredLiquidityAgeMs, futureToleranceMs }) as {
    evaluateStoredLiquidity: (quote: Record<string, unknown>, nowMs?: number) => WorkerLiquidityResult;
    compareStoredPreflightPriority: (left: WorkerPreflightItem, right: WorkerPreflightItem) => number;
  };
}

test("ordinary candidates use freshness-gated stored liquidity before and after SEC qualification", () => {
  const rolloutWorker = readRolloutWorker();

  assert.match(
    rolloutWorker,
    /maxStoredLiquidityAgeMs\s*=\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    "stored liquidity must use the conservative 24-hour freshness window",
  );
  assert.match(
    rolloutWorker,
    /providerTimestampPresent[\s\S]*?storedQuoteTimestampMs\s*=\s*providerTimestampPresent[\s\S]*?Date\.parse\(quote\.providerTimestamp\)[\s\S]*?Date\.parse\(String\(quote\?\.retrievedAt/,
    "provider timestamp must take precedence and retrievedAt may be used only when it is absent",
  );
  assert.match(
    rolloutWorker,
    /rankedStoredPreflightResults\s*=\s*verifiedPreflightResults\.sort\(compareStoredPreflightPriority\)[\s\S]*?secQualificationPool\s*=\s*rankedStoredPreflightResults\.slice/,
    "fresh verified liquidity must participate in ranking before the SEC qualification pool is sliced",
  );
  assert.match(
    rolloutWorker,
    /qualifiedOrdinaryCandidates\s*=\s*secQualificationResults[\s\S]*?\.filter\(\(item\) => item\.secQualificationOk\)[\s\S]*?\.sort\(\(left, right\) => \{[\s\S]*?storedLiquidityFresh[\s\S]*?rightLiquidity - leftLiquidity[\s\S]*?rightRevenue - leftRevenue[\s\S]*?\.slice\(0, ordinaryAttemptCount\)/,
    "later paid-attempt ranking must preserve fresh liquidity and verified annual-revenue priority",
  );
  assert.doesNotMatch(
    rolloutWorker,
    /\.filter\(\(item\) =>[^\n]*storedDollarVolume/,
    "stored liquidity must not become a hard eligibility filter because the rating engine uses multi-day average liquidity",
  );
  assert.match(rolloutWorker, /MAX_DIRECT_FALLBACK_PER_RUN:\s*"8"/);
  assert.match(rolloutWorker, /REQUEST_DELAY_MS:\s*"20000"/);
  assert.match(
    rolloutWorker,
    /const candidates = \[[\s\S]*?\.\.\.selectedProtectedCandidates,[\s\S]*?\.\.\.qualifiedOrdinaryCandidates/,
    "protected VCL priority must remain ahead of liquidity-ranked ordinary candidates",
  );
});

test("actual rollout worker rejects stale, malformed, and future liquidity before the bounded SEC slice", () => {
  const rolloutWorker = readRolloutWorker();
  const { evaluateStoredLiquidity, compareStoredPreflightPriority } = loadWorkerLiquidityPolicy(rolloutWorker);
  const nowMs = Date.parse("2026-08-30T16:14:00.000Z");
  const iso = (offsetMs: number): string => new Date(nowMs + offsetMs).toISOString();
  const freshLow = evaluateStoredLiquidity({
    price: 10,
    volume: 1_000,
    providerTimestamp: iso(-60_000),
  }, nowMs);
  const freshHigh = evaluateStoredLiquidity({
    price: 50,
    volume: 1_000_000,
    providerTimestamp: iso(-60_000),
  }, nowMs);
  const staleHuge = evaluateStoredLiquidity({
    price: 500,
    volume: 10_000_000,
    providerTimestamp: iso(-(24 * 60 * 60 * 1000 + 1)),
  }, nowMs);
  const malformed = evaluateStoredLiquidity({
    price: 500,
    volume: 10_000_000,
    providerTimestamp: "broken-provider-time",
    retrievedAt: iso(-1_000),
  }, nowMs);
  const future = evaluateStoredLiquidity({
    price: 500,
    volume: 10_000_000,
    providerTimestamp: iso(5 * 60 * 1000 + 1),
  }, nowMs);
  const retrievedAtFallback = evaluateStoredLiquidity({
    price: 25,
    volume: 4_000,
    retrievedAt: iso(-1_000),
  }, nowMs);

  assert.equal(freshHigh.storedLiquidityFresh, true);
  assert.equal(staleHuge.storedLiquidityFresh, false);
  assert.equal(malformed.storedLiquidityFresh, false);
  assert.equal(future.storedLiquidityFresh, false);
  assert.equal(retrievedAtFallback.storedLiquidityFresh, true);

  const item = (ticker: string, liquidity: WorkerLiquidityResult): WorkerPreflightItem => ({
    company: { ticker },
    filingCount: 8,
    factCount: 50,
    ratingCount: 0,
    ...liquidity,
  });
  const selected = [
    item("STALE", staleHuge),
    item("MALFORMED", malformed),
    item("FUTURE", future),
    item("LOW", freshLow),
    item("HIGH", freshHigh),
  ].sort(compareStoredPreflightPriority).slice(0, 2);

  assert.deepEqual(selected.map((candidate) => candidate.company.ticker), ["HIGH", "LOW"]);
});
