// TS: 2026-09-12 16:20 UTC

import { SecEdgarRequestError } from "./types.js";

const SEC_FUND_TICKERS_URL = "https://www.sec.gov/files/company_tickers_mf.json";
const FUND_TICKER_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

interface SecFundTickerResponse {
  readonly fields?: readonly string[];
  readonly data?: readonly (readonly unknown[])[];
}

export interface SecSecurityTypeEvidence {
  readonly securityType: "SEC registered fund";
  readonly provider: "sec-edgar";
  readonly sourceUrl: typeof SEC_FUND_TICKERS_URL;
}

let cache:
  | {
      readonly expiresAt: number;
      readonly tickers: ReadonlySet<string>;
    }
  | null = null;
let inFlight: Promise<ReadonlySet<string>> | null = null;

function normalizeSymbol(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
    throw new Error("Ticker symbol contains unsupported characters.");
  }
  return normalized;
}

function safeText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function tickerFieldIndex(fields: readonly string[]): number {
  return fields.findIndex((field) => field.trim().toLowerCase().replaceAll("_", "").includes("ticker"));
}

async function loadFundTickers(userAgent: string): Promise<ReadonlySet<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.tickers;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const response = await fetch(SEC_FUND_TICKERS_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new SecEdgarRequestError(response.status);

    const payload = (await response.json()) as SecFundTickerResponse;
    const fields = payload.fields ?? [];
    const tickerIndex = tickerFieldIndex(fields);
    if (tickerIndex < 0) {
      throw new Error("SEC fund ticker mapping did not contain a ticker field.");
    }

    const tickers = new Set<string>();
    for (const row of payload.data ?? []) {
      const ticker = safeText(row[tickerIndex])?.toUpperCase() ?? null;
      if (ticker && /^[A-Z0-9.-]{1,15}$/.test(ticker)) tickers.add(ticker);
    }

    const frozen = Object.freeze(tickers) as ReadonlySet<string>;
    cache = { expiresAt: Date.now() + FUND_TICKER_CACHE_TTL_MS, tickers: frozen };
    return frozen;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function getSecFundSecurityTypeEvidence(
  symbol: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<SecSecurityTypeEvidence | null> {
  const userAgent = environment.SEC_USER_AGENT?.trim();
  if (!userAgent) {
    throw new Error("SEC security-type preflight requires SEC_USER_AGENT.");
  }

  const normalized = normalizeSymbol(symbol);
  const tickers = await loadFundTickers(userAgent);
  if (!tickers.has(normalized)) return null;

  return Object.freeze({
    securityType: "SEC registered fund",
    provider: "sec-edgar",
    sourceUrl: SEC_FUND_TICKERS_URL,
  });
}
