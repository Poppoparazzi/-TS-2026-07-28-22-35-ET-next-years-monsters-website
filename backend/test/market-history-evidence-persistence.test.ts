// TS: 2026-08-30 10:01 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  getPersistedMarketHistorySuppression,
  MARKET_HISTORY_SUPPRESSION_MAX_AGE_MS,
  upsertMarketHistoryEvidence,
} from "../src/database/market-history-evidence-persistence.js";

test("persists provider-backed market history evidence with machine-readable eligibility state", async () => {
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
  assert.match(sql, /rating_eligibility_code/);
  assert.match(sql, /suppression_reason/);
  assert.match(sql, /ON CONFLICT \(company_id, provider\) DO UPDATE SET/);
  assert.match(sql, /EXCLUDED\.retrieved_at >= market_history_evidence\.retrieved_at/);
  assert.deepEqual(params, [
    "42",
    "licensed-test-provider",
    253,
    "2026-08-28",
    "2026-08-28T14:58:00.000Z",
    "licensed provider history",
    "eligible",
    null,
  ]);
});

test("persists insufficient market history as a reusable suppression reason", async () => {
  let params: readonly unknown[] = [];
  const client = {
    async query(_text: string, values?: readonly unknown[]) {
      params = values ?? [];
      return { rows: [], rowCount: 0 };
    },
  };

  await upsertMarketHistoryEvidence(client as never, "43", {
    symbol: "NEWC",
    provider: "licensed-test-provider",
    usableBarCount: 120,
    latestBarDate: "2026-08-28",
    retrievedAt: "2026-08-28T14:58:00.000Z",
    feedDisclosure: "licensed provider history",
  });

  assert.equal(params[6], "insufficient_market_history");
  assert.equal(params[7], "insufficient_market_history");
});

test("reads fresh persisted insufficient-history suppression without another provider call", async () => {
  let sql = "";
  let params: readonly unknown[] = [];
  const retrievedAt = "2026-08-28T14:58:00.000Z";
  const client = {
    async query(text: string, values?: readonly unknown[]) {
      sql = text;
      params = values ?? [];
      return {
        rows: [{
          rating_eligibility_code: "insufficient_market_history",
          suppression_reason: "insufficient_market_history",
          usable_bar_count: 120,
          retrieved_at: retrievedAt,
        }],
        rowCount: 1,
      };
    },
  };

  const suppression = await getPersistedMarketHistorySuppression(
    client as never,
    "43",
    "licensed-test-provider",
    Date.parse(retrievedAt) + 60 * 60 * 1000,
  );

  assert.match(sql, /FROM market_history_evidence/);
  assert.match(sql, /suppression_reason IS NOT NULL/);
  assert.match(sql, /ORDER BY retrieved_at DESC/);
  assert.deepEqual(params, ["43", "licensed-test-provider"]);
  assert.deepEqual(suppression, {
    ratingEligibilityCode: "insufficient_market_history",
    suppressionReason: "insufficient_market_history",
    usableBarCount: 120,
    retrievedAt,
  });
});

test("does not reuse stale persisted market-history suppression forever", async () => {
  const retrievedAt = "2026-08-28T14:58:00.000Z";
  const client = {
    async query() {
      return {
        rows: [{
          rating_eligibility_code: "insufficient_market_history",
          suppression_reason: "insufficient_market_history",
          usable_bar_count: 252,
          retrieved_at: retrievedAt,
        }],
        rowCount: 1,
      };
    },
  };

  assert.equal(
    await getPersistedMarketHistorySuppression(
      client as never,
      "44",
      "licensed-test-provider",
      Date.parse(retrievedAt) + MARKET_HISTORY_SUPPRESSION_MAX_AGE_MS + 1,
    ),
    null,
  );
});

test("returns null when no persisted market-history suppression exists", async () => {
  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  assert.equal(
    await getPersistedMarketHistorySuppression(client as never, "44", "licensed-test-provider"),
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
    () => upsertMarketHistoryEvidence(client as never, "42", { ...valid, feedDisclosure: "" }),
    /market_history_evidence_disclosure_required/,
  );
  await assert.rejects(
    () => getPersistedMarketHistorySuppression(client as never, "", "licensed-test-provider"),
    /market_history_evidence_company_id_required/,
  );
  await assert.rejects(
    () => getPersistedMarketHistorySuppression(client as never, "42", ""),
    /market_history_evidence_provider_required/,
  );

  assert.equal(queryCalls, 0);
});
