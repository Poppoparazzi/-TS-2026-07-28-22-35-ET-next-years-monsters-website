// TS: 2026-08-01 21:29 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";

const config: AppConfig = Object.freeze({
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 8787,
  corsOrigins: Object.freeze(["https://example.test"]),
  marketDataProvider: "unconfigured",
  twelveDataApiKey: null,
  secUserAgent: null,
  databaseUrl: null,
});

test("stored snapshot route requires the private database", async (t) => {
  const app = await buildApp({ config, logger: false });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/stored/AAPL" });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "provider_not_configured");
  assert.match(response.json().message, /database persistence provider/i);
});

test("stored snapshot route rejects malformed tickers before touching storage", async (t) => {
  const app = await buildApp({ config, logger: false });
  t.after(async () => app.close());

  const response = await app.inject({
    method: "GET",
    url: "/api/stored/AAPL%2F..%2Fsecret",
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "invalid_symbol");
});
