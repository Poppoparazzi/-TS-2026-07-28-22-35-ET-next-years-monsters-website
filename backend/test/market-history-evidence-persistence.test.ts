// TS: 2026-08-28 10:58 ET

import assert from "node:assert/strict";
import test from "node:test";
import { upsertMarketHistoryEvidence } from "../src/database/market-history-evidence-persistence.js";

test("persists provider-backed market history evidence without allowing older evidence to overwrite newer evidence", async () => {
  let sql = "";
  let params: readonly unknown[] = [];
  const client = {
    async query(text: string, values?: readonly unknown[]) {
      sql = text;
      params = values ?? [];
      return { rows: [], rowCount: 0 };
    },
  };

  await upsertMarketHistoryEvidence(client as never, "42", {
    symbol: "AAPL",
    provider: "licensed-test-provider",
    usableBarCount: 253,
    latestBarDate: "2026-08-28",
    retrievedAt: "2026-08-28T14:58:00.000Z",
    feedDisclosure: "licensed provider history",
  });

  assert.match(sql, /INSERT INTO market_history_evidence/);
  assert.match(sql, /ON CONFLICT \(company_id, provider\) DO UPDATE SET/);
  assert.match(sql, /EXCLUDED\.retrieved_at >= market_history_evidence\.retrieved_at/);
  assert.deepEqual(params, [
    "42",
    "licensed-test-provider",
    253,
    "2026-08-28",
    "2026-08-28T14:58:00.000Z",
    "licensed provider history",
  ]);
});
