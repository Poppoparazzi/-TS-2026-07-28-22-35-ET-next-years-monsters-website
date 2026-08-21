// TS: 2026-08-21 15:49 UTC

import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveBackfillInteger,
  getBackfillPolicySnapshot,
  getDeploymentBranch,
  getDeploymentCommit,
  getDeploymentProvider,
  isServerlessRuntime,
} from "../src/deployment-policy.js";
import { configuredUniverseImportLimit } from "../src/jobs/startup-universe-import.js";

function emptyEnvironment(): NodeJS.ProcessEnv {
  return {};
}

test("persistent production reports the effective 5000-to-2200 reserve fallbacks", () => {
  const policy = getBackfillPolicySnapshot("production", emptyEnvironment());

  assert.deepEqual(policy, {
    candidateTarget: 5_000,
    secBatchSize: 5_000,
    usableTarget: 2_200,
    concurrency: 8,
    maxAgeHours: 720,
  });
});

test("serverless production does not inherit persistent-worker SEC backfill fallbacks", () => {
  const environment: NodeJS.ProcessEnv = { VERCEL: "1" };
  const policy = getBackfillPolicySnapshot("production", environment);

  assert.equal(isServerlessRuntime(environment), true);
  assert.deepEqual(policy, {
    candidateTarget: null,
    secBatchSize: null,
    usableTarget: null,
    concurrency: null,
    maxAgeHours: null,
  });
});

test("stale explicit production values cannot shrink the agreed reserve policy", () => {
  const environment: NodeJS.ProcessEnv = {
    AUTO_IMPORT_UNIVERSE_LIMIT: "4800",
    AUTO_SEC_BATCH_SIZE: "4700",
    SEC_USABLE_TARGET: "2300",
    SEC_BATCH_CONCURRENCY: "6",
    SEC_BATCH_MAX_AGE_HOURS: "360",
  };

  assert.deepEqual(getBackfillPolicySnapshot("production", environment), {
    candidateTarget: 5_000,
    secBatchSize: 5_000,
    usableTarget: 2_300,
    concurrency: 8,
    maxAgeHours: 720,
  });
});

test("production startup promotes stale candidate limits while local jobs remain opt-in", () => {
  assert.equal(effectiveBackfillInteger("production", 2_000, 5_000), 5_000);
  assert.equal(effectiveBackfillInteger("test", 2_000, 5_000), 2_000);
  assert.equal(
    configuredUniverseImportLimit({ AUTO_IMPORT_UNIVERSE_LIMIT: "2000" }, 5_000),
    5_000,
  );
  assert.equal(
    configuredUniverseImportLimit({ AUTO_IMPORT_UNIVERSE_LIMIT: "2000" }, 0),
    2_000,
  );
});

test("deployment metadata prefers Vercel when both provider environments are present", () => {
  const environment: NodeJS.ProcessEnv = {
    VERCEL: "1",
    VERCEL_GIT_COMMIT_SHA: "vercel-commit",
    VERCEL_GIT_COMMIT_REF: "vercel-branch",
    RENDER: "true",
    RENDER_GIT_COMMIT: "render-commit",
    RENDER_GIT_BRANCH: "render-branch",
  };

  assert.equal(getDeploymentProvider(environment), "vercel");
  assert.equal(getDeploymentCommit(environment), "vercel-commit");
  assert.equal(getDeploymentBranch(environment), "vercel-branch");
});
