// TS: 2026-08-01 21:38 ET

import type { PersistenceStore, StoredCompanySnapshot } from "../database/persistence.js";
import type { MarketDataProvider } from "../providers/types.js";
import type { SecDataProvider } from "../sec/types.js";

export const PILOT_SYMBOLS = Object.freeze([
  "AAPL",
  "NVDA",
  "MNST",
  "AMZN",
  "TSLA",
  "NFLX",
  "AMD",
  "COST",
  "VRT",
  "AXON",
  "DECK",
  "WING",
  "META",
  "APP",
  "MSFT",
] as const);

export type QuoteRefreshStatus = "saved" | "unconfigured" | "unavailable";

export interface PilotRefreshResult {
  readonly symbol: string;
  readonly quoteStatus: QuoteRefreshStatus;
  readonly filingCount: number;
  readonly factCount: number;
  readonly stored: StoredCompanySnapshot;
  readonly completedAt: string;
}

export interface PilotRefreshDependencies {
  readonly marketProvider: MarketDataProvider;
  readonly secProvider: SecDataProvider;
  readonly persistenceStore: PersistenceStore;
}

export function normalizeRefreshSymbols(values: readonly string[]): readonly string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const symbol = value.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
      throw new Error(`Invalid pilot refresh ticker: ${value}`);
    }
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    normalized.push(symbol);
  }

  if (normalized.length === 0) {
    throw new Error("At least one pilot refresh ticker is required.");
  }

  return Object.freeze(normalized);
}

export async function refreshPilotSymbol(
  symbol: string,
  dependencies: PilotRefreshDependencies,
): Promise<PilotRefreshResult> {
  const { marketProvider, secProvider, persistenceStore } = dependencies;

  if (!persistenceStore.configured) {
    throw new Error("The private persistence database is not configured.");
  }
  if (!secProvider.configured) {
    throw new Error("The official SEC provider is not configured.");
  }

  const company = await secProvider.getCompany(symbol);
  const [filings, facts] = await Promise.all([
    secProvider.getRecentFilings(symbol, 10),
    secProvider.getCompanyFacts(symbol),
  ]);

  await persistenceStore.saveSecCompany(company);
  await persistenceStore.saveSecFilings(company, filings);
  await persistenceStore.saveSecFacts(facts);

  let quoteStatus: QuoteRefreshStatus = "unconfigured";
  if (marketProvider.configured) {
    try {
      const quote = await marketProvider.getQuote(symbol);
      await persistenceStore.saveQuote(quote);
      quoteStatus = "saved";
    } catch (_error) {
      quoteStatus = "unavailable";
    }
  }

  const stored = await persistenceStore.getStoredCompany(symbol);
  if (!stored) {
    throw new Error(`The refresh completed, but ${symbol} could not be read back from storage.`);
  }

  return Object.freeze({
    symbol,
    quoteStatus,
    filingCount: filings.length,
    factCount: Object.keys(facts.facts).length,
    stored,
    completedAt: new Date().toISOString(),
  });
}

export async function refreshPilotSymbols(
  symbols: readonly string[],
  dependencies: PilotRefreshDependencies,
): Promise<readonly PilotRefreshResult[]> {
  const results: PilotRefreshResult[] = [];

  for (const symbol of normalizeRefreshSymbols(symbols)) {
    results.push(await refreshPilotSymbol(symbol, dependencies));
  }

  return Object.freeze(results);
}
