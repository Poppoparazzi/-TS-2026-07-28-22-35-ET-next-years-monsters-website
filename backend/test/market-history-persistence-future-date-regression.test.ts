// TS: 2026-09-05 05:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import { upsertMarketHistoryEvidence } from "../src/database/market-history-evidence-persistence.js";

test("rejects future-dated latest market bar before persistence", async () => {
  let queryCalls = 0;
  const client = {
    async query() {
      queryCalls += 1;
      return { rows: [], rowCount: 0 };
    },
  };

  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", {
      symbol: "AAPL",
      provider: "licensed-test-provider",
      usableBarCount: 253,
      latestBarDate: "2026-09-06",
      twentySessionAverageDollarVolume: 25_000_000,
      retrievedAt: "2026-09-05T13:00:00.000Z",
      feedDisclosure: "licensed provider history",
    }),
    /market_history_evidence_future_latest_bar_date/,
  );

  assert.equal(queryCalls, 0);
});
