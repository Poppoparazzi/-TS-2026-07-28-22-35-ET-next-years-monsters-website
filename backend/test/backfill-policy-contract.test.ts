// TS: 2026-08-27 01:01 ET

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readRepositoryFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

test("production reserve policy stays deliberately overfilled and observable", () => {
  const renderYaml = readRepositoryFile("../../render.yaml");
  const serverSource = readRepositoryFile("../src/server.ts");
  const deploymentPolicySource = readRepositoryFile("../src/deployment-policy.ts");
  const coveragePolicySource = readRepositoryFile("../src/universe/coverage-policy.ts");

  assert.match(renderYaml, /key:\s*AUTO_IMPORT_UNIVERSE_LIMIT[\s\S]*?value:\s*"5000"/);
  assert.match(renderYaml, /key:\s*AUTO_SEC_BATCH_SIZE[\s\S]*?value:\s*"5000"/);
  assert.match(renderYaml, /key:\s*SEC_USABLE_TARGET[\s\S]*?value:\s*"2200"/);
  assert.match(renderYaml, /key:\s*SEC_BATCH_CONCURRENCY[\s\S]*?value:\s*"8"/);
  assert.match(renderYaml, /key:\s*SEC_BATCH_MAX_AGE_HOURS[\s\S]*?value:\s*"720"/);

  assert.match(
    serverSource,
    /backfillPolicy:\s*getBackfillPolicySnapshot\(config\.nodeEnv\)/,
    "startup status must expose the effective centralized backfill policy",
  );
  assert.match(deploymentPolicySource, /"AUTO_IMPORT_UNIVERSE_LIMIT"\),\s*useProductionFallbacks,\s*5_000/);
  assert.match(deploymentPolicySource, /"AUTO_SEC_BATCH_SIZE"\),\s*useProductionFallbacks,\s*5_000/);
  assert.match(deploymentPolicySource, /"SEC_USABLE_TARGET"\),\s*useProductionFallbacks,\s*2_200/);
  assert.match(deploymentPolicySource, /"SEC_BATCH_CONCURRENCY"\),\s*useProductionFallbacks,\s*8/);
  assert.match(deploymentPolicySource, /"SEC_BATCH_MAX_AGE_HOURS"\),\s*useProductionFallbacks,\s*720/);
  assert.match(coveragePolicySource, /ACTIVE_SEC_TARGET = 2_200/);
  assert.match(coveragePolicySource, /CANDIDATE_POOL_TARGET = 5_000/);

  const candidateTarget = Number(renderYaml.match(/key:\s*AUTO_IMPORT_UNIVERSE_LIMIT[\s\S]*?value:\s*"(\d+)"/)?.[1]);
  const usableTarget = Number(renderYaml.match(/key:\s*SEC_USABLE_TARGET[\s\S]*?value:\s*"(\d+)"/)?.[1]);

  assert.ok(candidateTarget >= 5000, "candidate target must preserve the 5,000-stock reserve strategy");
  assert.ok(usableTarget > 2000, "usable target must retain a cushion above 2,000");
  assert.ok(candidateTarget > usableTarget, "candidate pool must remain larger than the usable-stock target");
});

test("production rating recovery stays on the real licensed market-data path", () => {
  const renderYaml = readRepositoryFile("../../render.yaml");
  const startupRatingSource = readRepositoryFile("../src/jobs/startup-rating-batch.ts");

  assert.match(
    renderYaml,
    /key:\s*MARKET_DATA_PROVIDER[\s\S]*?value:\s*twelve-data/,
    "production rating recovery must use Twelve Data rather than the unconfigured provider",
  );
  assert.match(renderYaml, /key:\s*TWELVE_DATA_API_KEY[\s\S]*?sync:\s*false/);
  assert.match(renderYaml, /key:\s*RATING_TARGET_COUNT[\s\S]*?value:\s*"500"/);
  assert.match(
    renderYaml,
    /key:\s*RATING_CANDIDATE_LIMIT[\s\S]*?value:\s*"5000"/,
    "production rating recovery must be able to replace ineligible names from the full reserve",
  );
  assert.match(
    renderYaml,
    /key:\s*RATING_MARKET_REQUEST_DELAY_MS[\s\S]*?value:\s*"9000"/,
    "free-plan rating recovery must preserve safe request pacing",
  );
  assert.match(
    startupRatingSource,
    /const\s+isTwelveData\s*=\s*marketProvider\.name\s*===\s*"twelve-data"/,
    "startup rating recovery must explicitly recognize the Twelve Data provider",
  );
  assert.match(
    startupRatingSource,
    /const\s+defaultMarketDelayMs\s*=\s*isTwelveData\s*\?\s*9_000\s*:\s*0/,
    "Twelve Data startup batches must retain the safe 9-second fallback pacing",
  );
  assert.match(
    startupRatingSource,
    /RATING_CANDIDATE_LIMIT,\s*5_000,\s*5_000/,
    "startup rating recovery must retain the full 5,000-company reserve fallback",
  );
});

test("direct rating rollout preserves a visible first-500 milestone while continuing safely", () => {
  const rolloutWorker = readRepositoryFile("../../.github/workflows/rating-rollout-worker.yml");

  assert.match(rolloutWorker, /TARGET_COUNT:\s*"5000"/);
  assert.match(rolloutWorker, /FIRST_MILESTONE_COUNT:\s*"500"/);
  assert.match(rolloutWorker, /firstMilestoneReached/);
  assert.match(rolloutWorker, /remainingFirstMilestone/);
  assert.match(rolloutWorker, /First Monster Rating milestone reached/);
  assert.match(rolloutWorker, /STATUS_LIMIT:\s*"5000"/);
  assert.match(rolloutWorker, /MAX_DIRECT_FALLBACK_PER_RUN:\s*"8"/);
  assert.match(rolloutWorker, /MAX_PROTECTED_FALLBACK_PER_RUN:\s*"2"/);
  assert.match(rolloutWorker, /REQUEST_DELAY_MS:\s*"20000"/);
  assert.match(rolloutWorker, /PREFLIGHT_POOL_SIZE:\s*"192"/);
  assert.match(rolloutWorker, /PREFLIGHT_CONCURRENCY:\s*"8"/);
  assert.match(rolloutWorker, /SEC_QUALIFICATION_POOL_SIZE:\s*"64"/);
  assert.match(rolloutWorker, /SEC_QUALIFICATION_CONCURRENCY:\s*"4"/);
  assert.match(rolloutWorker, /cron:\s*"8,38 \* \* \* \*"/);
  assert.match(rolloutWorker, /backend\/src\/providers\/\*\*/);
  assert.match(rolloutWorker, /backend\/src\/sec\/\*\*/);
  assert.match(rolloutWorker, /backend\/src\/universe\/\*\*/);
  assert.match(rolloutWorker, /protectedVclTickers = Object\.freeze\(\[/);
  assert.match(rolloutWorker, /protectedAttemptCount = Math\.min\(/);
  assert.match(rolloutWorker, /preflightPoolSize/);
  assert.match(rolloutWorker, /preflightConcurrency/);
  assert.match(
    rolloutWorker,
    /verifiedPreflightResults = preflightResults\.filter\(\(item\) => item\.preflightOk\)/,
    "ordinary paid rating attempts must only come from successfully verified free stored-data preflights",
  );
  assert.match(
    rolloutWorker,
    /rankedStoredPreflightResults = verifiedPreflightResults\.sort/,
    "failed ordinary stored-data preflights must not enter the ranked shortlist",
  );
  assert.match(
    rolloutWorker,
    /secQualificationPool = rankedStoredPreflightResults\.slice\([\s\S]*?secQualificationPoolSize/,
    "only a bounded stored-data shortlist may enter free SEC qualification",
  );
  assert.match(
    rolloutWorker,
    /qualifiedOrdinaryCandidates = secQualificationResults[\s\S]*?\.filter\(\(item\) => item\.secQualificationOk\)[\s\S]*?\.slice\(0, ordinaryAttemptCount\)/,
    "only SEC-qualified ordinary candidates may fall through into paid candidate selection",
  );
  assert.match(
    rolloutWorker,
    /const candidates = \[[\s\S]*?\.\.\.selectedProtectedCandidates,[\s\S]*?\.\.\.qualifiedOrdinaryCandidates/,
    "the paid candidate cohort must use SEC-qualified ordinary candidates rather than the raw stored-data shortlist",
  );
  assert.match(
    rolloutWorker,
    /right\.filingCount - left\.filingCount \|\|[\s\S]*?right\.factCount - left\.factCount \|\|[\s\S]*?left\.ratingCount - right\.ratingCount/,
    "free stored-data ranking must still favor filing depth before fact depth and historical-rating tie breakers",
  );
  assert.match(
    rolloutWorker,
    /preflightOk:\s*false,\s*factCount:\s*-1,\s*filingCount:\s*-1/,
    "failed free preflights must remain explicitly marked as uncertain rather than looking evidence-rich",
  );
});

test("scheduled recovery and production closeout use the broad reserve", () => {
  const watchdog = readRepositoryFile("../../.github/workflows/render-redeploy-recovery.yml");
  const productionSmoke = readRepositoryFile("../../.github/workflows/production-smoke.yml");
  const productionVerifier = readRepositoryFile("../../scripts/verify-production.mjs");

  assert.match(watchdog, /cron:\s*"7 \* \* \* \*"/);
  assert.match(watchdog, /node scripts\/verify-production\.mjs/);
  assert.match(watchdog, /NYM_UNIVERSE_STATUS_LIMIT:\s*"5000"/);
  assert.match(productionSmoke, /NYM_EXPECTED_UNIVERSE_MIN:\s*"5000"/);
  assert.match(productionSmoke, /NYM_EXPECTED_USABLE_TARGET:\s*"2200"/);
  assert.doesNotMatch(productionSmoke, /expectedCount\s*=\s*2_000/);
  assert.match(productionVerifier, /api\/ratings\/AAPL/);
  assert.match(productionVerifier, /market-explorer\.html\?left=AAPL/);
  assert.match(productionVerifier, /monster-check\.html\?ticker=AAPL/);
});

test("ordinary SEC failures are replaceable while protected failures stay must-repair", () => {
  const processor = readRepositoryFile("../src/universe/sec-batch-processor.ts");
  const queue = readRepositoryFile("../src/universe/sec-batch-queue.ts");
  const store = readRepositoryFile("../src/universe/store.ts");
  const replacementMigration = readRepositoryFile(
    "../database/migrations/1002_track_reserve_replacements.sql",
  );

  assert.match(
    processor,
    /if \(!candidate\.isProtected\)[\s\S]*?queue\.markUnresolved/,
  );
  assert.match(processor, /disposition:\s*"must_repair"/);
  assert.match(queue, /PROTECTED_COMPANY_SQL_PREDICATE/);
  assert.match(store, /protectedMustRepairCount/);
  assert.match(store, /replaceableFailureCount/);
  assert.match(store, /replacementsAttemptedCount/);
  assert.match(store, /finalUsableUniverseCount/);
  assert.match(queue, /replacement_attempted = cps\.replacement_attempted OR/);
  assert.match(replacementMigration, /replacement_attempted boolean NOT NULL DEFAULT false/);
});

test("production fallbacks cannot silently disable or shrink the reserve strategy", () => {
  const importSource = readRepositoryFile("../src/jobs/startup-universe-import.ts");
  const batchSource = readRepositoryFile("../src/jobs/startup-sec-universe-batch.ts");

  assert.match(
    importSource,
    /config\.nodeEnv\s*===\s*"production"\s*\?\s*5_000\s*:\s*0/,
    "production universe import must fall back to 5,000 candidates",
  );
  assert.match(
    batchSource,
    /productionCandidateFallback\s*=\s*config\.nodeEnv\s*===\s*"production"\s*\?\s*5_000\s*:\s*0/,
    "production SEC batch must fall back to 5,000 candidates",
  );
  assert.match(
    batchSource,
    /effectiveBackfillInteger\([\s\S]*?"AUTO_SEC_BATCH_SIZE"[\s\S]*?5_000/,
    "stale production batch settings must be promoted to the 5,000-candidate policy",
  );
  assert.match(
    batchSource,
    /"SEC_USABLE_TARGET",\s*2_200,\s*1,\s*5_000/,
    "production SEC usable fallback must remain 2,200",
  );
  assert.match(
    batchSource,
    /"SEC_BATCH_CONCURRENCY",\s*8,\s*1,\s*8/,
    "production SEC concurrency fallback must remain 8",
  );
  assert.match(
    batchSource,
    /"SEC_BATCH_MAX_AGE_HOURS",\s*720,\s*1,\s*720/,
    "production SEC stale-window fallback must remain 720 hours",
  );
});

test("protected share-class tickers can retain shared SEC issuer evidence", () => {
  const migration = readRepositoryFile(
    "../database/migrations/1001_support_sec_share_classes.sql",
  );
  const persistenceSource = readRepositoryFile("../src/database/persistence.ts");
  const universeSource = readRepositoryFile("../src/universe/sec-source.ts");

  assert.match(migration, /DROP CONSTRAINT IF EXISTS companies_sec_cik_unique/);
  assert.match(migration, /UNIQUE \(company_id, accession_number\)/);
  assert.match(
    persistenceSource,
    /ON CONFLICT \(company_id, accession_number\) DO UPDATE SET/,
  );
  assert.match(universeSource, /PROTECTED_STRATEGIC_TICKERS/);
  assert.doesNotMatch(universeSource, /usedCiks/);
});