// TS: 2026-08-01 14:23 ET

import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type {
  MarketDataProvider,
  QuoteSnapshot,
  TickerSearchResult,
} from "../src/providers/types.js";
import { SecEdgarDataProvider } from "../src/sec/edgar.js";
import { UnconfiguredSecDataProvider } from "../src/sec/unconfigured.js";

const SEC_USER_AGENT = "NextYearsMonsters test@example.test";

class NoopMarketDataProvider implements MarketDataProvider {
  public readonly name = "noop-market";
  public readonly configured = false;

  public async searchTickers(
    _query: string,
    _limit = 10,
  ): Promise<readonly TickerSearchResult[]> {
    return [];
  }

  public async getQuote(_symbol: string): Promise<QuoteSnapshot> {
    throw new Error("Quote route is not used in SEC tests.");
  }
}

function testConfig(): AppConfig {
  return Object.freeze({
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 8787,
    corsOrigins: Object.freeze([]),
    marketDataProvider: "unconfigured",
    twelveDataApiKey: null,
    secUserAgent: null,
    databaseUrl: null,
  });
}

test("SEC adapter resolves a ticker and normalizes recent filings", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const userAgents: string[] = [];

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    requestedUrls.push(url);
    userAgents.push(new Headers(init?.headers).get("user-agent") ?? "");

    if (url.endsWith("company_tickers_exchange.json")) {
      return new Response(
        JSON.stringify({
          fields: ["cik", "name", "ticker", "exchange"],
          data: [[320193, "APPLE INC", "AAPL", "Nasdaq"]],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.endsWith("submissions/CIK0000320193.json")) {
      return new Response(
        JSON.stringify({
          cik: "320193",
          name: "Apple Inc.",
          filings: {
            recent: {
              accessionNumber: ["0000320193-26-000001"],
              filingDate: ["2026-07-28"],
              reportDate: ["2026-06-27"],
              acceptanceDateTime: ["2026-07-28T16:05:00.000Z"],
              form: ["10-Q"],
              fileNumber: ["001-36743"],
              primaryDocument: ["aapl-20260627.htm"],
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error(`Unexpected SEC test URL: ${url}`);
  }) as typeof fetch;

  try {
    const provider = new SecEdgarDataProvider(SEC_USER_AGENT);
    const company = await provider.getCompany("aapl");
    const filings = await provider.getRecentFilings("AAPL", 5);

    assert.equal(company.ticker, "AAPL");
    assert.equal(company.cik, 320193);
    assert.equal(company.cikPadded, "0000320193");
    assert.equal(company.exchange, "Nasdaq");
    assert.equal(filings.length, 1);
    assert.equal(filings[0]?.form, "10-Q");
    assert.equal(filings[0]?.filingDate, "2026-07-28");
    assert.match(filings[0]?.primaryDocumentUrl ?? "", /000032019326000001\/aapl-20260627\.htm$/);
    assert.equal(requestedUrls.filter((url) => url.endsWith("company_tickers_exchange.json")).length, 1);
    assert.equal(userAgents.every((value) => value === SEC_USER_AGENT), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SEC company facts retain context and source links", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.endsWith("company_tickers_exchange.json")) {
      return new Response(
        JSON.stringify({
          fields: ["cik", "name", "ticker", "exchange"],
          data: [[320193, "APPLE INC", "AAPL", "Nasdaq"]],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.endsWith("api/xbrl/companyfacts/CIK0000320193.json")) {
      return new Response(
        JSON.stringify({
          cik: 320193,
          entityName: "Apple Inc.",
          facts: {
            "us-gaap": {
              RevenueFromContractWithCustomerExcludingAssessedTax: {
                label: "Revenue",
                description: "Revenue from contracts with customers.",
                units: {
                  USD: [
                    {
                      start: "2025-09-28",
                      end: "2026-06-27",
                      val: 300000000000,
                      accn: "0000320193-26-000001",
                      fy: 2026,
                      fp: "Q3",
                      form: "10-Q",
                      filed: "2026-07-28",
                    },
                  ],
                },
              },
              Assets: {
                label: "Assets",
                description: "Total assets.",
                units: {
                  USD: [
                    {
                      end: "2026-06-27",
                      val: 350000000000,
                      accn: "0000320193-26-000001",
                      fy: 2026,
                      fp: "Q3",
                      form: "10-Q",
                      filed: "2026-07-28",
                    },
                  ],
                },
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    throw new Error(`Unexpected SEC test URL: ${url}`);
  }) as typeof fetch;

  try {
    const provider = new SecEdgarDataProvider(SEC_USER_AGENT);
    const summary = await provider.getCompanyFacts("AAPL");

    assert.equal(summary.ticker, "AAPL");
    assert.equal(summary.companyName, "Apple Inc.");
    assert.equal(summary.facts.revenue?.value, 300_000_000_000);
    assert.equal(summary.facts.revenue?.form, "10-Q");
    assert.equal(summary.facts.revenue?.fiscalPeriod, "Q3");
    assert.equal(summary.facts.assets?.value, 350_000_000_000);
    assert.match(summary.facts.revenue?.sourceUrl ?? "", /0000320193-26-000001-index\.html$/);
    assert.match(summary.disclosure, /Official SEC EDGAR/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("SEC routes return 503 when the required user agent is not configured", async (t) => {
  const app = await buildApp({
    config: testConfig(),
    provider: new NoopMarketDataProvider(),
    secProvider: new UnconfiguredSecDataProvider(),
    logger: false,
  });
  t.after(async () => app.close());

  const response = await app.inject({ method: "GET", url: "/api/sec/filings/AAPL" });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error, "provider_not_configured");
  assert.match(response.json().message, /not configured/i);
});
