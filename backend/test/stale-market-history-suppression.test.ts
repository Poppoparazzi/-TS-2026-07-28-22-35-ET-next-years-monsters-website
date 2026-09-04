// TS: 2026-09-04 19:57 ET

import assert from "node:assert/strict";
import test from "node:test";
import {
  getPersistedMarketHistorySuppression,
  STALE_MARKET_DATA_SUPPRESSION_MAX_AGE_MS,
  upsertMarketHistoryEvidence,
} from "../src/database/market-history-evidence-persistence.js";
import { EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL } from "../src/ratings/batch-store.js";

test("persists stale provider history with a machine-readable short-lived suppression", async () => {
  let params: readonly unknown[] = [];
  const client = {
    async query(_text: string, values?: readonly unknown[]) {
      params = values ?? [];
      return { rows: [], rowCount: 0 };
    },
  };

  await upsertMarketHistoryEvidence(client as never, "51", {
    symbol: "OLDC",
    provider: "licensed-test-provider",
    usableBarCount: 300,
    latestBarDate: "2026-08-20",
    twentySessionAverageDollarVolume: 5_000_000,
    suppressionReason: "stale_market_data",
    retrievedAt: "2026-09-04T23:01:00.000Z",
    feedDisclosure: "licensed provider history",
  });

  assert.equal(params[7], "stale_market_data");
  assert.equal(params[8], "stale_market_data");
});

test("reuses stale-market suppression for two days but not for the structural thirty-day window", async () => {
  const retrievedAt = "2026-09-04T23:01:00.000Z";
  const client = {
    async query() {
      return {
        rows: [{
          rating_eligibility_code: "stale_market_data",
          suppression_reason: "stale_market_data",
          usable_bar_count: 300,
          retrieved_at: retrievedAt,
        }],
        rowCount: 1,
      };
    },
  };

  const fresh = await getPersistedMarketHistorySuppression(
    client as never,
    "51",
    "licensed-test-provider",
    Date.parse(retrievedAt) + STALE_MARKET_DATA_SUPPRESSION_MAX_AGE_MS - 1,
  );
  assert.equal(fresh?.suppressionReason, "stale_market_data");

  const expired = await getPersistedMarketHistorySuppression(
    client as never,
    "51",
    "licensed-test-provider",
    Date.parse(retrievedAt) + STALE_MARKET_DATA_SUPPRESSION_MAX_AGE_MS + 1,
  );
  assert.equal(expired, null);
});

test("candidate selection excludes fresh durable stale evidence for only two days", () => {
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /suppression_reason = 'stale_market_data'/);
  assert.match(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /INTERVAL '2 days'/);
  assert.doesNotMatch(EXCLUDE_KNOWN_INSUFFICIENT_HISTORY_SQL, /suppression_reason = 'stale_market_data'[\s\S]*INTERVAL '30 days'/);
});

test("refuses to persist a stale suppression unless the provider evidence itself proves staleness", async () => {
  const client = {
    async query() {
      return { rows: [], rowCount: 0 };
    },
  };

  await assert.rejects(
    () => upsertMarketHistoryEvidence(client as never, "51", {
      symbol: "FRESH",
      provider: "licensed-test-provider",
      usableBarCount: 300,
      latestBarDate: "2026-09-04",
      suppressionReason: "stale_market_data",
      retrievedAt: "2026-09-04T23:01:00.000Z",
      feedDisclosure: "licensed provider history",
    }),
    /market_history_evidence_invalid_stale_market_data_suppression/,
  );
});
