// TS: 2026-08-26 11:58 ET

import assert from "node:assert/strict";
import test from "node:test";

import {
  isBackendTestOnly,
  isRatingRolloutKickOnly,
  isTimestampOnlyPatch,
  isTimestampOnlyRenderPatch,
} from "./resolve-backend-deploy-target.mjs";

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
