// TS: 2026-08-09 12:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  MONSTER_RATING_ENGINE_VERSION,
  RATING_COMPONENT_SPECIFICATIONS,
  ratingTier,
} from "../src/ratings/spec-v1.js";

test("rating engine version is explicit and stable", () => {
  assert.equal(MONSTER_RATING_ENGINE_VERSION, "nym-rating-v1.0.0");
});

test("rating component weights total exactly 100 percent", () => {
  const total = RATING_COMPONENT_SPECIFICATIONS.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  assert.ok(Math.abs(total - 1) < 0.000001);
  assert.equal(RATING_COMPONENT_SPECIFICATIONS.length, 13);
});

test("rating tiers preserve the unresolved 92 boundary instead of guessing", () => {
  assert.equal(ratingTier(93), "Platinum");
  assert.equal(ratingTier(92), "Tier Boundary Unresolved");
  assert.equal(ratingTier(91), "Gold");
  assert.equal(ratingTier(85), "Gold");
  assert.equal(ratingTier(84), "Silver");
  assert.equal(ratingTier(75), "Silver");
  assert.equal(ratingTier(74), "Bronze");
  assert.equal(ratingTier(65), "Bronze");
  assert.equal(ratingTier(64), "Goblin");
  assert.equal(ratingTier(50), "Goblin");
  assert.equal(ratingTier(49), "Cemetery Risk");
});
