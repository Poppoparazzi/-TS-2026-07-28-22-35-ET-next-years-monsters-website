// TS: 2026-08-10 03:04 UTC

import assert from "node:assert/strict";
import test from "node:test";

import { ProductionSingleSymbolEvidenceLoader } from "../src/ratings/production-evidence-loader.js";
import type { MarketEvidenceSource } from "../src/ratings/market-evidence.js";
import type { SecDataProvider } from "../src/sec/types.js";

const calculatedAt = "2026-08-10T03:04:00.000Z";

const secProvider: SecDataProvider = {
  name: "test-sec",
  configured: true,
  async getCompany(symbol) {
    return Object.freeze({
      ticker: symbol,
      cik: 320193,
      cikPadded: "0000320193",
      companyName: "Apple Inc.",
      exchange: "Nasdaq",
      sourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json",
    });
  },
  async getRecentFilings() {
    return Object.freeze([]);
  },
  async getCompanyFacts(symbol) {
    return Object.freeze({
      ticker: symbol,
      cik: 320193,
      companyName: "Apple Inc.",
      retrievedAt: calculatedAt,
      facts: Object.freeze({}),
      factHistory: Object.freeze({}),
      sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
      disclosure: "test",
    });
  },
};

test("loader preserves verified SEC identity while leaving unconfigured evidence explicitly missing", async () => {
  const loader = new ProductionSingleSymbolEvidenceLoader({ secProvider });
  const source = await loader.load("aapl", calculatedAt);

  assert.equal(source.symbol, "AAPL");
  assert.equal(source.secIdentityResolved, true);
  assert.equal(source.secCik, "0000320193");
  assert.equal(source.companyName, "Apple Inc.");
  assert.equal(source.companyMarket.providerConfigured, false);
  assert.equal(source.companyMarket.fetchedAt, null);
  assert.deepEqual(source.companyMarket.bars, []);
  assert.equal(source.benchmarkSymbol, "SPY");
  assert.equal(source.riskEvidence.verified, false);
  assert.equal(source.riskEvidence.checkedAt, null);
});

test("loader rejects cross-symbol market evidence by converting it to missing evidence", async () => {
  const badMarketProvider = {
    name: "licensed-test-market",
    configured: true,
    async load(): Promise<MarketEvidenceSource> {
      return Object.freeze({
        providerName: "licensed-test-market",
        providerConfigured: true,
        fetchedAt: calculatedAt,
        symbol: "MSFT",
        bars: Object.freeze([
          Object.freeze({ date: "2026-08-07", close: 100, volume: 1000 }),
        ]),
      });
    },
  };

  const loader = new ProductionSingleSymbolEvidenceLoader({
    secProvider,
    companyMarketProvider: badMarketProvider,
    benchmarkMarketProvider: badMarketProvider,
  });
  const source = await loader.load("AAPL", calculatedAt);

  assert.equal(source.companyMarket.symbol, "AAPL");
  assert.equal(source.companyMarket.fetchedAt, null);
  assert.deepEqual(source.companyMarket.bars, []);
});

test("SEC request failures become unresolved evidence rather than invented identity", async () => {
  const failingSecProvider: SecDataProvider = {
    ...secProvider,
    async getCompany() {
      throw new Error("SEC unavailable");
    },
  };

  const loader = new ProductionSingleSymbolEvidenceLoader({ secProvider: failingSecProvider });
  const source = await loader.load("AAPL", calculatedAt);

  assert.equal(source.secIdentityResolved, false);
  assert.equal(source.secCik, null);
  assert.equal(source.secFacts.cik, 0);
  assert.deepEqual(source.secFacts.facts, {});
});
