// TS: 2026-08-21 15:00 ET

import assert from "node:assert/strict";
import test from "node:test";
import { ratingRefreshEnabled } from "../src/jobs/startup-rating-batch.js";

test("persistent production keeps rating recovery enabled when Render env value is absent", () => {
  assert.equal(ratingRefreshEnabled({}, "production"), true);
  assert.equal(ratingRefreshEnabled({ RENDER: "true" }, "production"), true);
});

test("explicit rating refresh setting overrides the persistent production fallback", () => {
  assert.equal(
    ratingRefreshEnabled({ AUTO_REFRESH_RATINGS_ON_START: "false", RENDER: "true" }, "production"),
    false,
  );
  assert.equal(
    ratingRefreshEnabled({ AUTO_REFRESH_RATINGS_ON_START: "true" }, "test"),
    true,
  );
});

test("serverless and non-production runtimes remain opt-in", () => {
  assert.equal(ratingRefreshEnabled({ VERCEL: "1" }, "production"), false);
  assert.equal(ratingRefreshEnabled({ AWS_LAMBDA_FUNCTION_NAME: "nym" }, "production"), false);
  assert.equal(ratingRefreshEnabled({}, "test"), false);
  assert.equal(ratingRefreshEnabled({}, "development"), false);
});
