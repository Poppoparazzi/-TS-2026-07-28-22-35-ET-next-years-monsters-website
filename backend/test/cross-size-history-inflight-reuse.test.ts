// TS: 2026-09-08 06:58 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PROVIDER_PATH = new URL("../src/providers/twelve-data.ts", import.meta.url);

test("larger same-process paid history work can satisfy a smaller request without a second fetch", async () => {
  const source = await readFile(PROVIDER_PATH, "utf8");

  assert.match(source, /function findCompatibleDailyHistoryInFlight\(/);
  assert.match(source, /inFlightOutputSize > outputSize/);
  assert.match(source, /inFlightOutputSize < bestOutputSize/);
  assert.match(source, /const exactInFlight = dailyHistoryInFlight\.get\(cacheKey\);/);
  assert.match(source, /if \(exactInFlight\) \{\s*return exactInFlight;\s*\}/);
  assert.match(source, /if \(sharedHistory\.bars\.length >= safeOutputSize\)/);
  assert.match(source, /trimDailyHistory\(sharedHistory, safeOutputSize\)/);
  assert.match(source, /history\.bars\.slice\(-outputSize\)/);
});
