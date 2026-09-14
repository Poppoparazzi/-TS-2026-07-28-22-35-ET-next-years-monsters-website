// TS: 2026-09-14 05:15 UTC

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const APP_PATH = new URL("../src/app.ts", import.meta.url);

test("direct completed rating persistence retries without provider refetch and fails closed", async () => {
  const source = await readFile(APP_PATH, "utf8");

  assert.match(source, /persistCompletedRatingWithSingleRetry/);
  assert.match(source, /eligibilityCode: "completed_rating_persistence_pending"/);
  assert.match(source, /if \(!persistenceResult\.persisted\)/);

  const historyLoaderIndex = source.indexOf("const directHistoryResult = await loadDirectCompanyHistoryWithLease({");
  const readyHistoryIndex = source.indexOf("const companyHistory = directHistoryResult.history", historyLoaderIndex);
  const persistenceRetryIndex = source.indexOf("const persistenceResult = await persistCompletedRatingWithSingleRetry");
  const pendingReturnIndex = source.indexOf('eligibilityCode: "completed_rating_persistence_pending"');
  const ratedReturnIndex = source.indexOf('status: "rated"', pendingReturnIndex);

  assert.ok(historyLoaderIndex >= 0, "direct route must obtain company history through the quota-safe lease helper");
  assert.ok(readyHistoryIndex > historyLoaderIndex, "ready company history must be resolved before completed-rating persistence");
  assert.ok(persistenceRetryIndex > readyHistoryIndex, "completed-rating persistence must happen after company-history acquisition");
  assert.ok(pendingReturnIndex > persistenceRetryIndex, "failed durable persistence must return the pending machine reason");
  assert.ok(ratedReturnIndex > pendingReturnIndex, "rated response must remain after the fail-closed persistence branch");

  const retryBlock = source.slice(persistenceRetryIndex, pendingReturnIndex);
  assert.doesNotMatch(retryBlock, /getDailyHistory/);
  assert.doesNotMatch(retryBlock, /loadDirectCompanyHistoryWithLease/);
});
