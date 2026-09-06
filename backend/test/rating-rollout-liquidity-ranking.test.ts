// TS: 2026-09-06 14:57 ET

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
  compareStoredLiquidityPriority: (left: WorkerPreflightItem, right: WorkerPreflightItem) => number;
  compareStoredPreflightPriority: (left: WorkerPreflightItem, right: WorkerPreflightItem) => number;
} {
  const maxStoredLiquidityAgeMs = 24 * 60 * 60 * 1000;
  const futureToleranceMs = 5 * 60 * 1000;
  const source = [
    extractFunction(rolloutWorker, "evaluateStoredLiquidity"),
    extractFunction(rolloutWorker, "storedLiquidityPriority"),
    extractFunction(rolloutWorker, "compareStoredLiquidityPriority"),
    extractFunction(rolloutWorker, "compareStoredPreflightPriority"),
    "({ evaluateStoredLiquidity, compareStoredLiquidityPriority, compareStoredPreflightPriority })",
  ].join("\n");
  return runInNewContext(source, { maxStoredLiquidityAgeMs, futureToleranceMs }) as {
    evaluateStoredLiquidity: (quote: Record<string, unknown>, nowMs?: number) => WorkerLiquidityResult;
    compareStoredLiquidityPriority: (left: WorkerPreflightItem, right: WorkerPreflightItem) => number;
    compareStoredPreflightPriority: (left: WorkerPreflightItem, right: WorkerPreflightItem) => number;
  };
}

test("ordinary candidates use quota-safe stored-liquidity tiers before and after SEC qualification", () => {
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
    /storedLiquidityPriority[\s\S]*?storedDollarVolume\)\s*>=\s*1_000_000\s*\?\s*0\s*:\s*2/,
    "fresh stored quotes must rank as strong >=$1M first or weak sub-$1M last, with unknown handled separately",
  );
  assert.match(
    rolloutWorker,
    /rankedStoredPreflightResults\s*=\s*verifiedPreflightResults\.sort\(compareStoredPreflightPriority\)[\s\S]*?secQualificationPool\s*=\s*rankedStoredPreflightResults\.slice/,
    "quota-safe liquidity tiers must participate in ranking before the SEC qualification pool is sliced",
  );
  assert.match(
    rolloutWorker,
    /qualifiedOrdinaryCandidates\s*=\s*secQualificationResults[\s\S]*?item\.secQualificationOk[\s\S]*?!directSuppression\.active\.has\([\s\S]*?\.sort\(\(left, right\) => \{[\s\S]*?compareStoredLiquidityPriority\(left, right\)[\s\S]*?rightRevenue - leftRevenue[\s\S]*?\.slice\(0, ordinaryAttemptCount\)/,
    "later paid-attempt ranking must preserve SEC qualification, active suppression, quota-safe liquidity tiers, and verified annual-revenue priority",
  );
  assert.match(
    rolloutWorker,
    /qualifiedProtectedCandidates[\s\S]*?compareStoredLiquidityPriority\(left, right\)[\s\S]*?protectedVclTickers\.indexOf\(leftTicker\)/,
    "protected candidates must use the same liquidity tier policy while retaining VCL priority inside their protected cohort",
  );
  assert.doesNotMatch(
    rolloutWorker,
    /\.filter\(\(item\) =>[^\n]*storedDollarVolume/,
    "stored liquidity must not become a hard eligibility filter because a single quote is not durable suppression proof",
  );
  assert.match(rolloutWorker, /MAX_DIRECT_FALLBACK_PER_RUN:\s*"8"/);
  assert.match(rolloutWorker, /REQUEST_DELAY_MS:\s*"20000"/);
  assert.match(
    rolloutWorker,
    /const candidates = \[[\s\S]*?\.\.\.selectedProtectedCandidates,[\s\S]*?\.\.\.qualifiedOrdinaryCandidates/,
    "protected VCL priority must remain ahead of liquidity-ranked ordinary candidates",
  );
});

test("actual rollout worker ranks strong liquidity first, unknown second, and weak fresh quotes last", () => {
  const rolloutWorker = readRolloutWorker();
  const { evaluateStoredLiquidity, compareStoredLiquidityPriority, compareStoredPreflightPriority } = loadWorkerLiquidityPolicy(rolloutWorker);
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

  const item = (
    ticker: string,
    liquidity: WorkerLiquidityResult,
    filingCount = 8,
    factCount = 50,
  ): WorkerPreflightItem => ({
    company: { ticker },
    filingCount,
    factCount,
    ratingCount: 0,
    ...liquidity,
  });
  const unknown: WorkerLiquidityResult = { storedDollarVolume: null, storedLiquidityFresh: false };
  const selected = [
    item("WEAK", freshLow),
    item("UNKNOWN", unknown),
    item("STRONG", freshHigh),
  ].sort(compareStoredPreflightPriority);

  assert.deepEqual(
    selected.map((candidate) => candidate.company.ticker),
    ["STRONG", "UNKNOWN", "WEAK"],
    "scarce SEC and paid-history capacity must go to strong evidence first, unresolved liquidity second, and known weak fresh quotes last",
  );

  assert.ok(compareStoredLiquidityPriority(item("UNKNOWN", unknown), item("WEAK", freshLow)) < 0);
  assert.ok(compareStoredLiquidityPriority(item("STRONG", freshHigh), item("UNKNOWN", unknown)) < 0);

  const unknownMustBeatWeakEvenWithFewerFilings = [
    item("WEAK_MORE_FILINGS", freshLow, 500, 5_000),
    item("UNKNOWN_FEWER_FILINGS", unknown, 1, 1),
  ].sort(compareStoredPreflightPriority);
  assert.equal(
    unknownMustBeatWeakEvenWithFewerFilings[0]?.company.ticker,
    "UNKNOWN_FEWER_FILINGS",
    "known fresh sub-$1M quote evidence must not consume scarce provider work ahead of unknown liquidity merely because it has more generic filings/facts",
  );
});
