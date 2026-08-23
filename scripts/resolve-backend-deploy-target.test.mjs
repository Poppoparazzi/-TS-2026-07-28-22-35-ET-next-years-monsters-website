// TS: 2026-08-23 00:58 ET

import assert from "node:assert/strict";
import test from "node:test";

import {
  isRatingRolloutKickOnly,
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
