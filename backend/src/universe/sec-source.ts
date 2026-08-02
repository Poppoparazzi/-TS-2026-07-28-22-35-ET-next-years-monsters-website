// TS: 2026-08-02 14:24 ET

import type { UniverseCompany } from "./types.js";

const SEC_UNIVERSE_URL = "https://www.sec.gov/files/company_tickers_exchange.json";

interface SecTickerExchangeResponse {
  readonly fields?: readonly string[];
  readonly data?: readonly (readonly unknown[])[];
}

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizedTicker(value: unknown): string | null {
  const ticker = safeText(value)?.toUpperCase() ?? null;
  return ticker && /^[A-Z0-9.-]{1,15}$/.test(ticker) ? ticker : null;
}

export function parseSecUniversePayload(
  payload: SecTickerExchangeResponse,
  limit: number,
  sourceUrl = SEC_UNIVERSE_URL,
): readonly UniverseCompany[] {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 5_000);
  const fields = payload.fields ?? [];
  const cikIndex = fields.indexOf("cik");
  const nameIndex = fields.indexOf("name");
  const tickerIndex = fields.indexOf("ticker");
  const exchangeIndex = fields.indexOf("exchange");

  if (cikIndex < 0 || nameIndex < 0 || tickerIndex < 0) {
    throw new Error("SEC ticker universe did not contain cik, name, and ticker fields.");
  }

  const byTicker = new Map<string, UniverseCompany>();

  for (const row of payload.data ?? []) {
    const cik = safeNumber(row[cikIndex]);
    const companyName = safeText(row[nameIndex]);
    const ticker = normalizedTicker(row[tickerIndex]);
    const exchange = exchangeIndex >= 0 ? safeText(row[exchangeIndex]) : null;

    if (cik === null || !companyName || !ticker || byTicker.has(ticker)) continue;

    byTicker.set(ticker, {
      ticker,
      companyName,
      exchange,
      cik,
      cikPadded: String(cik).padStart(10, "0"),
      sourceUrl,
    });
  }

  return Object.freeze(
    [...byTicker.values()]
      .sort((left, right) => left.ticker.localeCompare(right.ticker))
      .slice(0, safeLimit),
  );
}

export async function loadSecUniverse(
  userAgent: string,
  limit: number,
): Promise<readonly UniverseCompany[]> {
  if (!userAgent.trim()) throw new Error("SEC_USER_AGENT is required to import the universe.");

  const response = await fetch(SEC_UNIVERSE_URL, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`SEC universe request failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as SecTickerExchangeResponse;
  return parseSecUniversePayload(payload, limit, SEC_UNIVERSE_URL);
}
