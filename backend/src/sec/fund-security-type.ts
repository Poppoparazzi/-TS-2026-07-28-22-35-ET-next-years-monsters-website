// TS: 2026-09-12 21:02 UTC

import { SecEdgarRequestError } from "./types.js";

const SEC_FUND_TICKERS_URL = "https://www.sec.gov/files/company_tickers_mf.json";
const SEC_COMPANY_TICKERS_EXCHANGE_URL = "https://www.sec.gov/files/company_tickers_exchange.json";
const FUND_TICKER_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;

interface SecTickerTableResponse {
  readonly fields?: readonly string[];
  readonly data?: readonly (readonly unknown[])[];
}

export interface SecSecurityTypeEvidence {
  readonly securityType: "SEC registered fund";
  readonly provider: "sec-edgar";
  readonly sourceUrl: typeof SEC_FUND_TICKERS_URL;
  readonly identitySourceUrl: typeof SEC_COMPANY_TICKERS_EXCHANGE_URL;
}

interface CachedFundTickerEvidence {
  readonly expiresAt: number;
  readonly fundCiksByTicker: ReadonlyMap<string, ReadonlySet<number>>;
}

interface CachedCurrentTickerIdentity {
  readonly expiresAt: number;
  readonly currentCikByTicker: ReadonlyMap<string, number>;
}

let fundCache: CachedFundTickerEvidence | null = null;
let fundInFlight: Promise<CachedFundTickerEvidence> | null = null;
let identityCache: CachedCurrentTickerIdentity | null = null;
let identityInFlight: Promise<CachedCurrentTickerIdentity> | null = null;

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

function safeCik(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function exactFieldIndex(fields: readonly string[], names: readonly string[]): number {
  const normalizedNames = new Set(names.map((name) => name.toLowerCase().replaceAll("_", "")));
  return fields.findIndex((field) => normalizedNames.has(field.trim().toLowerCase().replaceAll("_", "")));
}

async function fetchTickerTable(url: string, userAgent: string): Promise<SecTickerTableResponse> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": userAgent,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new SecEdgarRequestError(response.status);
  return (await response.json()) as SecTickerTableResponse;
}

function buildFundCiksByTicker(payload: SecTickerTableResponse): ReadonlyMap<string, ReadonlySet<number>> {
  const fields = payload.fields ?? [];
  const tickerIndex = exactFieldIndex(fields, ["ticker", "symbol"]);
  const cikIndex = exactFieldIndex(fields, ["cik"]);
  if (tickerIndex < 0 || cikIndex < 0) {
    throw new Error("SEC fund ticker mapping did not contain authoritative ticker and CIK fields.");
  }

  const mutable = new Map<string, Set<number>>();
  for (const row of payload.data ?? []) {
    const ticker = safeText(row[tickerIndex])?.toUpperCase() ?? null;
    const cik = safeCik(row[cikIndex]);
    if (!ticker || !/^[A-Z0-9.-]{1,15}$/.test(ticker) || cik === null) continue;
    const ciks = mutable.get(ticker) ?? new Set<number>();
    ciks.add(cik);
    mutable.set(ticker, ciks);
  }

  return Object.freeze(new Map(
    [...mutable.entries()].map(([ticker, ciks]) => [ticker, Object.freeze(new Set(ciks)) as ReadonlySet<number>]),
  ));
}

function buildCurrentCikByTicker(payload: SecTickerTableResponse): ReadonlyMap<string, number> {
  const fields = payload.fields ?? [];
  const tickerIndex = exactFieldIndex(fields, ["ticker", "symbol"]);
  const cikIndex = exactFieldIndex(fields, ["cik"]);
  if (tickerIndex < 0 || cikIndex < 0) {
    throw new Error("SEC company ticker mapping did not contain authoritative ticker and CIK fields.");
  }

  const result = new Map<string, number>();
  for (const row of payload.data ?? []) {
    const ticker = safeText(row[tickerIndex])?.toUpperCase() ?? null;
    const cik = safeCik(row[cikIndex]);
    if (!ticker || !/^[A-Z0-9.-]{1,15}$/.test(ticker) || cik === null) continue;
    result.set(ticker, cik);
  }
  return Object.freeze(result);
}

async function loadFundTickerEvidence(userAgent: string): Promise<CachedFundTickerEvidence> {
  if (fundCache && fundCache.expiresAt > Date.now()) return fundCache;
  if (fundInFlight) return fundInFlight;

  fundInFlight = (async () => {
    const payload = await fetchTickerTable(SEC_FUND_TICKERS_URL, userAgent);
    const loaded: CachedFundTickerEvidence = Object.freeze({
      expiresAt: Date.now() + FUND_TICKER_CACHE_TTL_MS,
      fundCiksByTicker: buildFundCiksByTicker(payload),
    });
    fundCache = loaded;
    return loaded;
  })();

  try {
    return await fundInFlight;
  } finally {
    fundInFlight = null;
  }
}

async function loadCurrentTickerIdentity(userAgent: string): Promise<CachedCurrentTickerIdentity> {
  if (identityCache && identityCache.expiresAt > Date.now()) return identityCache;
  if (identityInFlight) return identityInFlight;

  identityInFlight = (async () => {
    const payload = await fetchTickerTable(SEC_COMPANY_TICKERS_EXCHANGE_URL, userAgent);
    const loaded: CachedCurrentTickerIdentity = Object.freeze({
      expiresAt: Date.now() + FUND_TICKER_CACHE_TTL_MS,
      currentCikByTicker: buildCurrentCikByTicker(payload),
    });
    identityCache = loaded;
    return loaded;
  })();

  try {
    return await identityInFlight;
  } finally {
    identityInFlight = null;
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
  const fundEvidence = await loadFundTickerEvidence(userAgent);
  const fundCiks = fundEvidence.fundCiksByTicker.get(normalized);
  if (!fundCiks || fundCiks.size === 0) return null;

  // Most candidates are not SEC-registered funds. Do not make the second SEC mapping request unless
  // the authoritative fund map actually contains this ticker. A fund-map miss stays UNKNOWN without
  // adding another network dependency to the common-stock path.
  const currentIdentity = await loadCurrentTickerIdentity(userAgent);

  // SEC notes that its ticker association files are periodically updated and not guaranteed to be
  // exhaustive. A ticker-only hit could therefore be stale after symbol reuse. Require the fund-map
  // CIK to agree with the SEC's current ticker/exchange association before treating the security as
  // an authoritative unsupported fund. Ambiguous/mismatched evidence stays UNKNOWN, never common.
  const currentCik = currentIdentity.currentCikByTicker.get(normalized);
  if (!currentCik || !fundCiks.has(currentCik)) return null;

  return Object.freeze({
    securityType: "SEC registered fund",
    provider: "sec-edgar",
    sourceUrl: SEC_FUND_TICKERS_URL,
    identitySourceUrl: SEC_COMPANY_TICKERS_EXCHANGE_URL,
  });
}
