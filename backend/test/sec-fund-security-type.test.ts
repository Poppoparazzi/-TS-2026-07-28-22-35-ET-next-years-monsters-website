// TS: 2026-09-12 22:00 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { getSecFundSecurityTypeEvidence } from "../src/sec/fund-security-type.js";

test("SEC fund preflight defers the current-identity map until a fund ticker actually matches", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const userAgents: string[] = [];

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    requestedUrls.push(url);
    userAgents.push(new Headers(init?.headers).get("user-agent") ?? "");

    if (url.endsWith("company_tickers_mf.json")) {
      return new Response(JSON.stringify({
        fields: ["cik", "seriesId", "classId", "ticker"],
        data: [
          [123456, "S000000001", "C000000001", "FUNDX"],
          [123456, "S000000001", "C000000002", "FUNDY"],
          [777777, "S000000002", "C000000003", "REUSED"],
          [111111, "S000000003", "C000000004", "AMBIG"],
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    if (url.endsWith("company_tickers_exchange.json")) {
      return new Response(JSON.stringify({
        fields: ["cik", "name", "ticker", "exchange"],
        data: [
          [123456, "Example Fund", "FUNDX", "NYSE"],
          [123456, "Example Fund", "FUNDY", "NASDAQ"],
          [888888, "Current Operating Company", "REUSED", "NYSE"],
          [111111, "Possible Fund Identity", "AMBIG", "NYSE"],
          [222222, "Conflicting Current Identity", "AMBIG", "NASDAQ"],
          [320193, "Apple Inc.", "AAPL", "NASDAQ"],
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }

    throw new Error(`Unexpected SEC test URL: ${url}`);
  }) as typeof fetch;

  try {
    const environment = { SEC_USER_AGENT: "NextYearsMonsters test@example.test" } as NodeJS.ProcessEnv;

    const unknownEvidence = await getSecFundSecurityTypeEvidence("AAPL", environment);
    assert.equal(unknownEvidence, null, "A fund-map miss must remain unknown rather than being labeled common stock.");
    assert.equal(requestedUrls.length, 1, "A non-fund candidate should load only the SEC fund map.");
    assert.ok(requestedUrls[0]?.endsWith("company_tickers_mf.json"));

    const fundEvidence = await getSecFundSecurityTypeEvidence("fundx", environment);
    const reusedTickerEvidence = await getSecFundSecurityTypeEvidence("REUSED", environment);
    const ambiguousTickerEvidence = await getSecFundSecurityTypeEvidence("AMBIG", environment);

    assert.deepEqual(fundEvidence, {
      securityType: "SEC registered fund",
      provider: "sec-edgar",
      sourceUrl: "https://www.sec.gov/files/company_tickers_mf.json",
      identitySourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json",
    });
    assert.equal(
      reusedTickerEvidence,
      null,
      "A stale fund-map ticker whose current SEC CIK belongs to another issuer must remain unknown instead of being falsely suppressed.",
    );
    assert.equal(
      ambiguousTickerEvidence,
      null,
      "Multiple current SEC CIKs for one ticker are ambiguous and must not suppress a candidate based on row order.",
    );
    assert.equal(requestedUrls.length, 2, "The current SEC ticker/CIK map should load only after a fund-map hit, then remain cached.");
    assert.ok(requestedUrls.some((url) => url.endsWith("company_tickers_mf.json")));
    assert.ok(requestedUrls.some((url) => url.endsWith("company_tickers_exchange.json")));
    assert.deepEqual(new Set(userAgents), new Set([environment.SEC_USER_AGENT]));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
