// TS: 2026-09-10 01:09 ET

import assert from "node:assert/strict";
import test from "node:test";
import { SEC_REPLACEMENT_BUDGET_FILTER_SQL } from "../src/universe/sec-batch-queue.js";

test("SEC replacement budget excludes retry-pending failed rows", () => {
  assert.match(SEC_REPLACEMENT_BUDGET_FILTER_SQL, /sec_status = 'unresolved'/);
  assert.doesNotMatch(
    SEC_REPLACEMENT_BUDGET_FILTER_SQL,
    /'failed'/,
    "transient failed rows still inside bounded retry/backoff must not create replacement slots",
  );
});

test("SEC replacement budget still excludes protected stocks", () => {
  assert.match(SEC_REPLACEMENT_BUDGET_FILTER_SQL, /NOT/);
});
