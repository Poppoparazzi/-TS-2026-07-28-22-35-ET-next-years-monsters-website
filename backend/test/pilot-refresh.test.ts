// TS: 2026-08-01 21:45 ET

import assert from "node:assert/strict";
import test from "node:test";
import type {
  PersistenceStore,
  StoredCompanySnapshot,
} from "../src/database/persistence.js";
import {
  normalizeRefreshSymbols,
  refreshPilotSymbol,
} from "../src/jobs/pilot-refresh.js";
import { UnconfiguredMarketDataProvider } from "../src/providers/unconfigured.js";
import type {
  MarketDataProvider,
  QuoteSnapshot,
  TickerSearchResult,
} from "../src/providers/types.js";
import type {
  SecCompany,
  SecCompanyFactsSummary,
  SecDataProvider,
  SecFilingSummary,
} from "../src/sec/types.js";

const company: SecCompany = Object.freeze({
  ticker: "AAPL",
  cik: 320193,
  cikPadded: "0000320193",
  companyName: "Apple Inc.",
  exchange: "NASDAQ",
  sourceUrl: "https://www.sec.gov/edgar/browse/?CIK=320193",
});

const filing: SecFilingSummary = Object.freeze({
  ticker: "AAPL",
  cik: 320193,
  companyName: "Apple Inc.",
  accessionNumber: "0000320193-25-000001",
  filingDate: "2025-10-31",
  reportDate: "2025-09-27",
  acceptanceDateTime: "2025-10-31T12:00:00.000Z",
  form: "10-K",
  fileNumber: "001-36743",
  primaryDocument: "aapl-20250927.htm",
  primaryDocumentUrl: "https://www.sec.gov/Archives/edgar/data/320193/example.htm",
});

const facts: SecCompanyFactsSummary = Object.freeze({
  ticker: "AAPL",
  cik: 320193,
  companyName: "Apple Inc.",
  retrievedAt: "2026-08-01T21:40:00.000Z",
  sourceUrl: "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json",
  disclosure: "Official SEC company facts.",
  facts: Object.freeze({
    revenue: Object.freeze({
      key: "revenue",
      taxonomy: "us-gaap",
      tag: "RevenueFromContractWithCustomerExcludingAssessedTax",
      label: "Revenue",
      description: "Test revenue fact.",
      unit: "USD",
      value: 100,
      form: "10-K",
      fiscalYear: 2025,
      fiscalPeriod: "FY",
      periodStart: "2024-09-29",
      periodEnd: "2025-09-27",
      filed: "2025-10-31",
      accessionNumber: "0000320193-25-000001",
      sourceUrl: "https://www.sec.gov/Archives/edgar/data/320193/example.htm",
    }),
  }),
});

const storedSnapshot: StoredCompanySnapshot = Object.freeze({
  ticker: "AAPL",
  companyName: "Apple Inc.",
  exchange: "NASDAQ",
  currency: "USD",
  secCik: "0000320193",
  updatedAt: "2026-08-01T21:40:00.000Z",
  latestQuote: null,
  latestFiling: Object.freeze({
    accessionNumber: filing.accessionNumber,
    form: filing.form,
    filingDate: filing.filingDate,
    reportDate: filing.reportDate,
    acceptedAt: filing.acceptanceDateTime,
    primaryDocumentUrl: filing.primaryDocumentUrl,
  }),
  filingCount: 1,
  factCount: 1,
  ratingCount: 0,
});

class StaticSecProvider implements SecDataProvider {
  public readonly name = "static-sec";
  public readonly configured = true;

  public async getCompany(_symbol: string): Promise<SecCompany> {
    return company;
  }

  public async getRecentFilings(
    _symbol: string,
    _limit = 10,
  ): Promise<readonly SecFilingSummary[]> {
    return Object.freeze([filing]);
  }

  public async getCompanyFacts(_symbol: string): Promise<SecCompanyFactsSummary> {
    return facts;
  }
}

class MemoryPersistenceStore implements PersistenceStore {
  public readonly name = "memory-persistence";
  public readonly configured = true;
  public companySaves = 0;
  public filingSaves = 0;
  public factSaves = 0;
  public quoteSaves = 0;

  public async saveQuote(_quote: QuoteSnapshot): Promise<void> {
    this.quoteSaves += 1;
  }

  public async saveSecCompany(_company: SecCompany): Promise<void> {
    this.companySaves += 1;
  }

  public async saveSecFilings(
    _company: SecCompany,
    _filings: readonly SecFilingSummary[],
  ): Promise<void> {
    this.filingSaves += 1;
  }

  public async saveSecFacts(_summary: SecCompanyFactsSummary): Promise<void> {
    this.factSaves += 1;
  }

  public async getStoredCompany(_symbol: string): Promise<StoredCompanySnapshot | null> {
    return storedSnapshot;
  }

  public async close(): Promise<void> {}
}

class FailingMarketProvider implements MarketDataProvider {
  public readonly name = "failing-market";
  public readonly configured = true;

  public async searchTickers(
    _query: string,
    _limit = 10,
  ): Promise<readonly TickerSearchResult[]> {
    return Object.freeze([]);
  }

  public async getQuote(_symbol: string): Promise<QuoteSnapshot> {
    throw new Error("Test quote failure.");
  }
}

test("pilot refresh symbol normalization deduplicates and rejects malformed values", () => {
  assert.deepEqual(normalizeRefreshSymbols([" aapl ", "AAPL", "msft"]), ["AAPL", "MSFT"]);
  assert.throws(() => normalizeRefreshSymbols(["AAPL/../secret"]), /invalid pilot refresh ticker/i);
  assert.throws(() => normalizeRefreshSymbols([]), /at least one/i);
});

test("pilot refresh persists SEC evidence when market quotes are unconfigured", async () => {
  const persistenceStore = new MemoryPersistenceStore();
  const result = await refreshPilotSymbol("AAPL", {
    marketProvider: new UnconfiguredMarketDataProvider(),
    secProvider: new StaticSecProvider(),
    persistenceStore,
  });

  assert.equal(result.symbol, "AAPL");
  assert.equal(result.quoteStatus, "unconfigured");
  assert.equal(result.filingCount, 1);
  assert.equal(result.factCount, 1);
  assert.equal(result.stored.ticker, "AAPL");
  assert.equal(persistenceStore.companySaves, 1);
  assert.equal(persistenceStore.filingSaves, 1);
  assert.equal(persistenceStore.factSaves, 1);
  assert.equal(persistenceStore.quoteSaves, 0);
});

test("pilot refresh preserves SEC progress when a configured quote provider fails", async () => {
  const persistenceStore = new MemoryPersistenceStore();
  const result = await refreshPilotSymbol("AAPL", {
    marketProvider: new FailingMarketProvider(),
    secProvider: new StaticSecProvider(),
    persistenceStore,
  });

  assert.equal(result.quoteStatus, "unavailable");
  assert.equal(result.stored.latestFiling?.form, "10-K");
  assert.equal(persistenceStore.companySaves, 1);
  assert.equal(persistenceStore.filingSaves, 1);
  assert.equal(persistenceStore.factSaves, 1);
  assert.equal(persistenceStore.quoteSaves, 0);
});
