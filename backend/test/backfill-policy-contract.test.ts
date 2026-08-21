// TS: 2026-08-21 07:01 ET

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
  assert.match(deploymentPolicySource, /"AUTO_IMPORT_UNIVERSE_LIMIT"[\s\S]*?5_000\s*:\s*null/);
  assert.match(deploymentPolicySource, /"AUTO_SEC_BATCH_SIZE"[\s\S]*?5_000\s*:\s*null/);
  assert.match(deploymentPolicySource, /"SEC_USABLE_TARGET"[\s\S]*?2_200\s*:\s*null/);
  assert.match(deploymentPolicySource, /"SEC_BATCH_CONCURRENCY"[\s\S]*?8\s*:\s*null/);
  assert.match(deploymentPolicySource, /"SEC_BATCH_MAX_AGE_HOURS"[\s\S]*?720\s*:\s*null/);

  const candidateTarget = Number(renderYaml.match(/key:\s*AUTO_IMPORT_UNIVERSE_LIMIT[\s\S]*?value:\s*"(\d+)"/)?.[1]);
  const usableTarget = Number(renderYaml.match(/key:\s*SEC_USABLE_TARGET[\s\S]*?value:\s*"(\d+)"/)?.[1]);

  assert.ok(candidateTarget >= 5000, "candidate target must preserve the 5,000-stock reserve strategy");
  assert.ok(usableTarget > 2000, "usable target must retain a cushion above 2,000");
  assert.ok(candidateTarget > usableTarget, "candidate pool must remain larger than the usable-stock target");
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
