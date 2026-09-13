// TS: 2026-09-13 17:09 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const APP_PATH = new URL("../src/app.ts", import.meta.url);

test("direct completed rating persistence retries without provider refetch and fails closed", async () => {
  const source = await readFile(APP_PATH, "utf8");

  assert.match(source, /persistCompletedRatingWithSingleRetry/);
  assert.match(source, /eligibilityCode: "completed_rating_persistence_pending"/);
  assert.match(source, /if \(!persistenceResult\.persisted\)/);

  const providerFetchIndex = source.indexOf("const companyHistory = await provider.getDailyHistory(symbol, 300)");
  const persistenceRetryIndex = source.indexOf("const persistenceResult = await persistCompletedRatingWithSingleRetry");
  const pendingReturnIndex = source.indexOf('eligibilityCode: "completed_rating_persistence_pending"');
  const ratedReturnIndex = source.indexOf('status: "rated"', pendingReturnIndex);

  assert.ok(providerFetchIndex >= 0);
  assert.ok(persistenceRetryIndex > providerFetchIndex);
  assert.ok(pendingReturnIndex > persistenceRetryIndex);
  assert.ok(ratedReturnIndex > pendingReturnIndex);

  const retryBlock = source.slice(persistenceRetryIndex, pendingReturnIndex);
  assert.doesNotMatch(retryBlock, /provider\.getDailyHistory/);
});
