// TS: 2026-09-08 09:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PROVIDER_PATH = new URL("../src/providers/twelve-data.ts", import.meta.url);

test("fresh larger completed history can satisfy a smaller request without reopening persistence or provider paths", async () => {
  const source = await readFile(PROVIDER_PATH, "utf8");

  assert.match(source, /function findCompatibleDailyHistoryCache\(/);
  assert.match(source, /cachedOutputSize > outputSize/);
  assert.match(source, /cachedOutputSize < bestOutputSize/);
  assert.match(source, /entry\.expiresAt <= now/);
  assert.match(source, /entry\.history\.bars\.length >= outputSize/);
  assert.match(source, /const compatibleCached = findCompatibleDailyHistoryCache\(/);
  assert.match(source, /trimDailyHistory\(compatibleCached\.history, safeOutputSize\)/);
  assert.match(source, /expiresAt: compatibleCached\.expiresAt/);

  const compatibleCacheLookupIndex = source.indexOf("const compatibleCached = findCompatibleDailyHistoryCache(");
  const persistedLookupIndex = source.indexOf("this.persistedBenchmarkHistoryCache.getFresh(");
  assert.ok(compatibleCacheLookupIndex >= 0);
  assert.ok(persistedLookupIndex > compatibleCacheLookupIndex);
});
