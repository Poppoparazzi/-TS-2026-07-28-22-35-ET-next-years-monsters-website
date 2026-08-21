// TS: 2026-08-21 15:16 UTC

import {
  isProtectedStrategicTicker,
  PROTECTED_STRATEGIC_TICKERS,
} from "../policy/protected-stocks.js";
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

function lastReplaceableIndex(companies: readonly UniverseCompany[]): number {
  for (let index = companies.length - 1; index >= 0; index -= 1) {
    const company = companies[index];
    if (company && !isProtectedStrategicTicker(company.ticker)) return index;
  }
  return -1;
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

    if (
      cik === null ||
      !companyName ||
      !ticker ||
      byTicker.has(ticker)
    ) {
      continue;
    }

    byTicker.set(ticker, {
      ticker,
      companyName,
      exchange,
      cik,
      cikPadded: String(cik).padStart(10, "0"),
      sourceUrl,
    });
  }

  // Preserve the SEC file's upstream priority order while guaranteeing that any
  // protected strategic ticker present in the source survives the 5,000-row cap.
  // Multiple share classes may legitimately share one CIK and remain separate
  // customer lookup symbols (for example GOOGL and GOOG).
  const selected = [...byTicker.values()].slice(0, safeLimit);
  const selectedTickers = new Set(selected.map((company) => company.ticker));

  for (const protectedTicker of PROTECTED_STRATEGIC_TICKERS) {
    const protectedCompany = byTicker.get(protectedTicker);
    if (!protectedCompany || selectedTickers.has(protectedTicker)) continue;

    if (selected.length >= safeLimit) {
      const replaceIndex = lastReplaceableIndex(selected);
      if (replaceIndex < 0) break;
      selectedTickers.delete(selected[replaceIndex]!.ticker);
      selected[replaceIndex] = protectedCompany;
    } else {
      selected.push(protectedCompany);
    }
    selectedTickers.add(protectedTicker);
  }

  return Object.freeze(selected);
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
