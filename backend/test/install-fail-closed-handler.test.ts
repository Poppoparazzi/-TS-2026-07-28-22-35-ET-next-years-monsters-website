// TS: 2026-08-14 09:03 ET

import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { ProviderNotConfiguredError } from "../src/providers/types.js";
import { installFailClosedRatingErrorHandler } from "../src/ratings/install-fail-closed-handler.js";
import { SecCompanyNotFoundError, SecEdgarRequestError } from "../src/sec/types.js";

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
  assert.equal(payload.symbol, "AAPL");
  assert.equal(payload.score, null);
  assert.equal(payload.tier, "NOT YET RATED");
  assert.equal(payload.eligible, false);
  assert.equal(payload.reasons[0].code, "gate_marketQuote");
});

test("missing SEC identity stays fail-closed and names the identity gate", async (t) => {
  const app = Fastify({ logger: false });
  installFailClosedRatingErrorHandler(app);
  app.get("/api/ratings/:symbol", async () => {
    throw new SecCompanyNotFoundError("XXXX");
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/XXXX" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.symbol, "XXXX");
  assert.equal(payload.score, null);
  assert.equal(payload.eligible, false);
  assert.equal(payload.reasons[0].code, "gate_secIdentity");
});

test("SEC EDGAR retrieval failures stay fail-closed and name financial evidence", async (t) => {
  const app = Fastify({ logger: false });
  installFailClosedRatingErrorHandler(app);
  app.get("/api/ratings/:symbol", async () => {
    throw new SecEdgarRequestError(503);
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/RKLB" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.symbol, "RKLB");
  assert.equal(payload.score, null);
  assert.equal(payload.eligible, false);
  assert.equal(payload.reasons[0].code, "gate_financialEvidence");
});

test("generic rating evidence failures also remain fail-closed", async (t) => {
  const app = Fastify({ logger: false });
  installFailClosedRatingErrorHandler(app);
  app.get("/api/ratings/:symbol", async () => {
    throw new Error("Evidence fetch failed");
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/ratings/RKLB" });
  const payload = response.json();

  assert.equal(response.statusCode, 200);
  assert.equal(payload.symbol, "RKLB");
  assert.equal(payload.score, null);
  assert.equal(payload.tier, "NOT YET RATED");
  assert.equal(payload.eligible, false);
  assert.equal(payload.reasons[0].code, "required_evidence_incomplete");
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
