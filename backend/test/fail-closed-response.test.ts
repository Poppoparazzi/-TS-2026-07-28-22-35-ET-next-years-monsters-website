// TS: 2026-08-29 08:40 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildFailClosedRatingResponse } from "../src/ratings/fail-closed-response.js";

test("withholds a score when required production evidence is unavailable", () => {
  const response = buildFailClosedRatingResponse("aapl", "2026-08-14T04:00:00.000Z", [
    {
      code: "gate_marketQuote",
      message: "A positive ticker-matched quote with provider provenance is required.",
    },
  ]);

  assert.equal(response.symbol, "AAPL");
  assert.equal(response.eligible, false);
  assert.equal(response.score, null);
  assert.equal(response.tier, "NOT YET RATED");
  assert.equal(response.eligibilityCode, "required_evidence_incomplete");
  assert.match(response.summary, /Insufficient Evidence for Prediction/);
  assert.equal(response.rollout.message, "Not Yet Rated — Insufficient Evidence for Prediction.");
  assert.equal(response.reasons.length, 1);
  assert.equal(response.reasons[0]?.code, "gate_marketQuote");
});

test("supplies an explicit incomplete-evidence reason instead of an empty failure", () => {
  const response = buildFailClosedRatingResponse("rkLB", "2026-08-14T04:00:00.000Z", []);

  assert.equal(response.symbol, "RKLB");
  assert.equal(response.score, null);
  assert.equal(response.reasons[0]?.code, "required_evidence_incomplete");
  assert.match(response.reasons[0]?.message ?? "", /incomplete|verified/i);
});
