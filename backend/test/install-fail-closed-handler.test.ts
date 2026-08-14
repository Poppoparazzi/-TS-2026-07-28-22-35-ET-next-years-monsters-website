// TS: 2026-08-14 03:10 ET

import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { ProviderNotConfiguredError } from "../src/providers/types.js";
import { installFailClosedRatingErrorHandler } from "../src/ratings/install-fail-closed-handler.js";

test("rating provider failures return a truthful fail-closed response", async (t) => {
  const app = Fastify({ logger: false });
  installFailClosedRatingErrorHandler(app);
  app.get("/api/ratings/:symbol", async () => {
    throw new ProviderNotConfiguredError("unconfigured");
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/aapl" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.symbol, "aapl");
  assert.equal(payload.score, null);
  assert.equal(payload.tier, "NOT YET RATED");
  assert.equal(payload.eligible, false);
  assert.equal(payload.reasons[0].code, "gate_marketQuote");
});

test("non-rating provider failures retain service-unavailable semantics", async (t) => {
  const app = Fastify({ logger: false });
  installFailClosedRatingErrorHandler(app);
  app.get("/api/quotes/:symbol", async () => {
    throw new ProviderNotConfiguredError("unconfigured");
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/quotes/AAPL" });
  const payload = response.json();

  assert.equal(response.statusCode, 503);
  assert.equal(payload.error, "provider_not_configured");
});
