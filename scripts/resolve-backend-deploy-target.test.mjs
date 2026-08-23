// TS: 2026-08-23 02:04 ET

import assert from "node:assert/strict";
import test from "node:test";

import {
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
    isRatingRolloutKickOnly([
      "backend/src/policy/rating-rollout-kick-20260822.ts",
      "backend/src/ratings/engine.ts",
    ]),
    false,
  );
  assert.equal(isRatingRolloutKickOnly(["backend/src/ratings/engine.ts"]), false);
});
