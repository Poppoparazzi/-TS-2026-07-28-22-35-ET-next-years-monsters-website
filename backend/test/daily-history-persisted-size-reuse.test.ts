// TS: 2026-09-08 04:00 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const CACHE_PATH = new URL("../src/database/benchmark-history-cache.ts", import.meta.url);

test("fresh larger persisted daily history can satisfy a smaller request without another paid fetch", async () => {
  const source = await readFile(CACHE_PATH, "utf8");
  const getFreshStart = source.indexOf("public async getFresh(");
  const saveStart = source.indexOf("public async save(", getFreshStart);

  assert.notEqual(getFreshStart, -1, "getFresh implementation must exist");
  assert.notEqual(saveStart, -1, "save implementation must follow getFresh");

  const getFreshSource = source.slice(getFreshStart, saveStart);
  assert.match(getFreshSource, /AND output_size >= \$3/);
  assert.match(getFreshSource, /ORDER BY output_size ASC, retrieved_at DESC/);
  assert.match(getFreshSource, /row\.bars\.slice\(-normalizedOutputSize\)/);
  assert.doesNotMatch(getFreshSource, /AND output_size = \$3/);
});
