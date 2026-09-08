// TS: 2026-09-07 23:02 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CACHE_PATH = new URL("../src/database/benchmark-history-cache.ts", import.meta.url);

test("fresh larger persisted daily history can satisfy a smaller request without another paid fetch", async () => {
  const source = await readFile(CACHE_PATH, "utf8");

  assert.match(source, /AND output_size >= \$3/);
  assert.match(source, /ORDER BY output_size ASC, retrieved_at DESC/);
  assert.match(source, /row\.bars\.slice\(-normalizedOutputSize\)/);
  assert.doesNotMatch(source, /AND output_size = \$3/);
});
