// TS: 2026-09-07 20:10 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../database/migrations/1021_benchmark_history_refresh_claims.sql", import.meta.url);
const cacheUrl = new URL("../src/database/benchmark-history-cache.ts", import.meta.url);
const providerUrl = new URL("../src/providers/twelve-data.ts", import.meta.url);

test("daily-history refreshes are leased across processes before paid Twelve Data history", async () => {
  const [migration, cache, provider] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(cacheUrl, "utf8"),
    readFile(providerUrl, "utf8"),
  ]);

  assert.match(
    migration,
    /CREATE TABLE IF NOT EXISTS benchmark_history_refresh_claims[\s\S]*PRIMARY KEY \(symbol, provider, output_size\)/,
    "daily-history refresh claims need one database row per symbol/provider/output-size key",
  );

  assert.match(
    cache,
    /ON CONFLICT \(symbol, provider, output_size\) DO UPDATE SET[\s\S]*WHERE benchmark_history_refresh_claims\.claimed_until <= now\(\)[\s\S]*RETURNING claim_token/,
    "an unexpired refresh lease must not be stolen by another process",
  );

  const acquireIndex = provider.indexOf(".acquireRefreshLease(");
  const paidRequestIndex = provider.indexOf('this.request<TwelveDataTimeSeriesResponse>');
  assert.ok(
    acquireIndex >= 0 && paidRequestIndex > acquireIndex,
    "every persisted daily-history symbol must acquire its database lease before the paid history request",
  );

  assert.match(
    provider,
    /if \(acquired === false\)[\s\S]*getFresh\([\s\S]*Daily market history refresh is already in progress/,
    "a process that loses the lease must wait for persisted history instead of spending duplicate quota",
  );

  assert.match(
    provider,
    /finally \{[\s\S]*refreshLeaseAcquired[\s\S]*releaseRefreshLease\(/,
    "the winning process must release its daily-history refresh lease on success or failure",
  );
});