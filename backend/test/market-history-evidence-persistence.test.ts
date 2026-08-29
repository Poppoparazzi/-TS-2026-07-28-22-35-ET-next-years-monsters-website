// TS: 2026-08-29 17:02 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  getMarketHistoryEvidence,
  upsertMarketHistoryEvidence,
} from "../src/database/market-history-evidence-persistence.js";

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

test("reads persisted provider-backed market history evidence for quota-safe reuse", async () => {
  let sql = "";
  let params: readonly unknown[] = [];
  const client = {
    async query(text: string, values?: readonly unknown[]) {
      sql = text;
      params = values ?? [];
      return {
        rows: [{
          provider: "licensed-test-provider",
          usable_bar_count: 253,
          latest_bar_date: new Date("2026-08-28T00:00:00.000Z"),
          retrieved_at: new Date("2026-08-28T14:58:00.000Z"),
          feed_disclosure: "licensed provider history",
        }],
        rowCount: 1,
      };
    },
  };

  const evidence = await getMarketHistoryEvidence(
    client as never,
    "42",
    "licensed-test-provider",
    "aapl",
  );

  assert.match(sql, /FROM market_history_evidence/);
  assert.match(sql, /company_id = \$1/);
  assert.match(sql, /provider = \$2/);
  assert.deepEqual(params, ["42", "licensed-test-provider"]);
  assert.deepEqual(evidence, {
    symbol: "AAPL",
    provider: "licensed-test-provider",
    usableBarCount: 253,
    latestBarDate: "2026-08-28",
    retrievedAt: "2026-08-28T14:58:00.000Z",
    feedDisclosure: "licensed provider history",
  });
});

test("returns null when no persisted market history evidence exists", async () => {
  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  assert.equal(
    await getMarketHistoryEvidence(client as never, "42", "licensed-test-provider", "AAPL"),
    null,
  );
});

test("fails closed before SQL when market history evidence is not trustworthy", async () => {
  let queryCalls = 0;
  const client = {
    async query() {
      queryCalls += 1;
      return { rows: [], rowCount: 0 };
    },
  };

  const valid = {
    symbol: "AAPL",
    provider: "licensed-test-provider",
    usableBarCount: 253,
    latestBarDate: "2026-08-28",
    retrievedAt: "2026-08-28T14:58:00.000Z",
    feedDisclosure: "licensed provider history",
  } as const;

  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "", valid),
    /market_history_evidence_company_id_required/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, provider: "" }),
    /market_history_evidence_provider_required/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, usableBarCount: -1 }),
    /market_history_evidence_invalid_usable_bar_count/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, usableBarCount: 252.5 }),
    /market_history_evidence_invalid_usable_bar_count/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, latestBarDate: "08/28/2026" }),
    /market_history_evidence_invalid_latest_bar_date/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, latestBarDate: null }),
    /market_history_evidence_invalid_latest_bar_date/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, usableBarCount: 0 }),
    /market_history_evidence_invalid_latest_bar_date/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, retrievedAt: "not-a-time" }),
    /market_history_evidence_invalid_retrieved_at/,
  );
  await assert.rejects(
    () => getMarketHistoryEvidence(client as never, "", "licensed-test-provider", "AAPL"),
    /market_history_evidence_company_id_required/,
  );
  await assert.rejects(
    () => getMarketHistoryEvidence(client as never, "42", "", "AAPL"),
    /market_history_evidence_provider_required/,
  );
  await assert.rejects(
    () => getMarketHistoryEvidence(client as never, "42", "licensed-test-provider", ""),
    /market_history_evidence_symbol_required/,
  );
  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, feedDisclosure: "" }),
    /market_history_evidence_disclosure_required/,
  );

  assert.equal(queryCalls, 0);
});
