// TS: 2026-09-12 16:29 UTC

import assert from "node:assert/strict";
import test from "node:test";
import { getSecFundSecurityTypeEvidence } from "../src/sec/fund-security-type.js";

test("SEC fund ticker map identifies known funds and leaves nonmatches unknown", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const userAgents: string[] = [];

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    requestedUrls.push(url);
    userAgents.push(new Headers(init?.headers).get("user-agent") ?? "");
    if (!url.endsWith("company_tickers_mf.json")) throw new Error(`Unexpected SEC test URL: ${url}`);

    return new Response(JSON.stringify({
      fields: ["cik", "seriesId", "classId", "ticker"],
      data: [
        [123456, "S000000001", "C000000001", "FUNDX"],
        [123456, "S000000001", "C000000002", "FUNDY"],
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const environment = { SEC_USER_AGENT: "NextYearsMonsters test@example.test" } as NodeJS.ProcessEnv;
    const fundEvidence = await getSecFundSecurityTypeEvidence("fundx", environment);
    const unknownEvidence = await getSecFundSecurityTypeEvidence("AAPL", environment);

    assert.deepEqual(fundEvidence, {
      securityType: "SEC registered fund",
      provider: "sec-edgar",
      sourceUrl: "https://www.sec.gov/files/company_tickers_mf.json",
    });
    assert.equal(unknownEvidence, null, "A fund-map miss must remain unknown rather than being labeled common stock.");
    assert.equal(requestedUrls.length, 1, "The SEC fund map should be cached across ticker checks.");
    assert.equal(userAgents[0], environment.SEC_USER_AGENT);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
