// TS: 2026-09-11 20:02 UTC

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  isBackendTestOnly,
  isRatingRolloutKickOnly,
  isTimestampOnlyPatch,
  isTimestampOnlyRenderPatch,
  resolveBackendDeployTarget,
} from "./resolve-backend-deploy-target.mjs";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("timestamp-only render nudges are not deployment targets", () => {
  assert.equal(
    isTimestampOnlyRenderPatch("-# TS: 2026-08-22 18:00 ET\n+# TS: 2026-08-22 18:01 ET"),
    true,
  );
  assert.equal(
    isTimestampOnlyRenderPatch(
      "-# TS: 2026-08-22 18:00 ET\n+# TS: 2026-08-22 18:01 ET\n+  AUTO_SEC_BATCH_SIZE: 5000",
    ),
    false,
  );
});

test("timestamp-only backend source changes are not deployment targets", () => {
  assert.equal(
    isTimestampOnlyPatch("-// TS: 2026-08-22 05:17 ET\n+// TS: 2026-08-23 05:23 UTC"),
    true,
  );
  assert.equal(
    isTimestampOnlyPatch(
      "-// TS: 2026-08-22 05:17 ET\n+// TS: 2026-08-23 05:23 UTC\n+const targetCount = 500;",
    ),
    false,
  );
});

test("rating-rollout kick marker commits are not deployment targets", () => {
  assert.equal(
    isRatingRolloutKickOnly(["backend/src/policy/rating-rollout-kick-20260822.ts"]),
    true,
  );
  assert.equal(
    isRatingRolloutKickOnly(["backend/src/policy/rating-rollout-kick-20260823-1824.ts"]),
    true,
  );
  assert.equal(
    isRatingRolloutKickOnly(["backend/src/ratings/.worker-kick-20260826-1025.md"]),
    true,
  );
  assert.equal(
    isRatingRolloutKickOnly([
      "backend/src/policy/rating-rollout-kick-20260822.ts",
      "backend/src/ratings/engine.ts",
    ]),
    false,
  );
  assert.equal(
    isRatingRolloutKickOnly([
      "backend/src/ratings/.worker-kick-20260826-1025.md",
      "backend/src/ratings/engine.ts",
    ]),
    false,
  );
  assert.equal(isRatingRolloutKickOnly(["backend/src/ratings/engine.ts"]), false);
});

test("backend test-only commits do not make Render look stale", () => {
  assert.equal(
    isBackendTestOnly([
      "backend/test/rating-batch.test.ts",
      "backend/test/twelve-data.test.ts",
    ]),
    true,
  );
  assert.equal(
    isBackendTestOnly([
      "backend/test/rating-batch.test.ts",
      "backend/src/jobs/rating-batch.ts",
    ]),
    false,
  );
  assert.equal(isBackendTestOnly(["scripts/verify-production.mjs"]), false);
});

test("Render deployment target is the merged main SHA, not the PR head SHA", () => {
  const cwd = mkdtempSync(join(tmpdir(), "nym-deploy-target-"));
  try {
    git(cwd, ["init", "-b", "main"]);
    git(cwd, ["config", "user.name", "NYM Test"]);
    git(cwd, ["config", "user.email", "nym-test@example.invalid"]);

    mkdirSync(join(cwd, "backend", "src"), { recursive: true });
    writeFileSync(join(cwd, "backend", "src", "server.ts"), "export const version = 1;\n");
    git(cwd, ["add", "backend/src/server.ts"]);
    git(cwd, ["commit", "-m", "base backend"]);

    git(cwd, ["checkout", "-b", "feature"]);
    writeFileSync(join(cwd, "backend", "src", "server.ts"), "export const version = 2;\n");
    git(cwd, ["commit", "-am", "feature backend"]);
    const prHeadSha = git(cwd, ["rev-parse", "HEAD"]);

    git(cwd, ["checkout", "main"]);
    git(cwd, ["merge", "--no-ff", "feature", "-m", "Merge pull request"]);
    const mergedMainSha = git(cwd, ["rev-parse", "HEAD"]);

    assert.notEqual(mergedMainSha, prHeadSha);
    assert.equal(resolveBackendDeployTarget({ cwd }), mergedMainSha);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
