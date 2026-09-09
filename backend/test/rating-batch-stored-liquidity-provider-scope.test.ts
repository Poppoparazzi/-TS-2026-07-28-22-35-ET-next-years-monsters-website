// TS: 2026-09-09 03:01 ET

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("stored quote liquidity ranking is scoped to the active market provider", async () => {
  const source = await readFile(new URL("../src/ratings/batch-store.ts", import.meta.url), "utf8");
  const storedLiquidityBlock = source.match(
    /LEFT JOIN LATERAL \(\s*SELECT \(qs\.price \* qs\.volume\)::numeric AS dollar_volume[\s\S]*?\) stored_liquidity ON true/,
  )?.[0];

  assert.ok(storedLiquidityBlock, "expected the stored-liquidity candidate-ranking subquery");
  assert.match(storedLiquidityBlock, /qs\.provider = \$3/);
  assert.match(source, /\[safeLimit, MONSTER_RATING_ENGINE_VERSION, safeProvider\]/);
});
