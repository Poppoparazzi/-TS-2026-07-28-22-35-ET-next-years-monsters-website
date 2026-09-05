// TS: 2026-09-04 20:58 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  getPersistedMarketHistorySuppression,
  getPersistedMarketHistorySuppressionByTicker,
} from "../src/database/market-history-evidence-persistence.js";

test("company suppression lookup evaluates only the newest evidence row", async () => {
  let sql = "";
  const client = {
    async query(text: string) {
      sql = text;
      return { rows: [], rowCount: 0 };
    },
  };

  const result = await getPersistedMarketHistorySuppression(
    client as never,
    "42",
    "licensed-test-provider",
    Date.parse("2026-09-05T00:58:00.000Z"),
  );

  assert.equal(result, null);
  assert.match(sql, /FROM \(\s*SELECT[\s\S]*FROM market_history_evidence[\s\S]*ORDER BY retrieved_at DESC[\s\S]*LIMIT 1\s*\) latest/);
  assert.match(sql, /WHERE latest\.suppression_reason IS NOT NULL/);
  assert.doesNotMatch(sql, /AND suppression_reason IS NOT NULL[\s\S]*ORDER BY retrieved_at DESC/);
});

test("ticker suppression lookup cannot resurrect an older suppressed row", async () => {
  let sql = "";
  const client = {
    async query(text: string) {
      sql = text;
      return { rows: [], rowCount: 0 };
    },
  };

  const result = await getPersistedMarketHistorySuppressionByTicker(
    client as never,
    "AAPL",
    "licensed-test-provider",
    Date.parse("2026-09-05T00:58:00.000Z"),
  );

  assert.equal(result, null);
  assert.match(sql, /FROM \(\s*SELECT[\s\S]*FROM market_history_evidence mhe[\s\S]*ORDER BY mhe\.retrieved_at DESC[\s\S]*LIMIT 1\s*\) latest/);
  assert.match(sql, /WHERE latest\.suppression_reason IS NOT NULL/);
  assert.doesNotMatch(sql, /AND mhe\.suppression_reason IS NOT NULL[\s\S]*ORDER BY mhe\.retrieved_at DESC/);
});
