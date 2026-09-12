// TS: 2026-09-12 20:00 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { getPersistedMarketHistorySuppressionByTicker } from "../src/database/market-history-evidence-persistence.js";

function suppressionClient(latestBarDate: string) {
  return {
    async query() {
      return {
        rows: [{
          rating_eligibility_code: "insufficient_market_history",
          suppression_reason: "insufficient_market_history",
          usable_bar_count: 250,
          latest_bar_date: latestBarDate,
          retrieved_at: `${latestBarDate}T20:00:00.000Z`,
        }],
        rowCount: 1,
      };
    },
  };
}

test("keeps insufficient-history suppression until the conservative completed-session catch-up threshold", async () => {
  const suppression = await getPersistedMarketHistorySuppressionByTicker(
    suppressionClient("2026-09-07") as never,
    "NEWC",
    "licensed-test-provider",
    Date.parse("2026-09-11T12:00:00.000Z"),
  );

  assert.equal(suppression?.suppressionReason, "insufficient_market_history");
});

test("releases insufficient-history suppression once enough completed weekdays have elapsed", async () => {
  const suppression = await getPersistedMarketHistorySuppressionByTicker(
    suppressionClient("2026-09-07") as never,
    "NEWC",
    "licensed-test-provider",
    Date.parse("2026-09-12T12:00:00.000Z"),
  );

  assert.equal(suppression, null);
});

test("keeps the conservative 30-day fallback when latest-bar date is unavailable", async () => {
  const client = {
    async query() {
      return {
        rows: [{
          rating_eligibility_code: "insufficient_market_history",
          suppression_reason: "insufficient_market_history",
          usable_bar_count: 250,
          latest_bar_date: null,
          retrieved_at: "2026-09-07T20:00:00.000Z",
        }],
        rowCount: 1,
      };
    },
  };

  const suppression = await getPersistedMarketHistorySuppressionByTicker(
    client as never,
    "NEWC",
    "licensed-test-provider",
    Date.parse("2026-09-12T12:00:00.000Z"),
  );

  assert.equal(suppression?.suppressionReason, "insufficient_market_history");
});
