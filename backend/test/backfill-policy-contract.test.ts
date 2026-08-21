// TS: 2026-08-21 15:49 UTC

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
