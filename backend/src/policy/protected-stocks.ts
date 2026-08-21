// TS: 2026-08-21 15:16 UTC

export const PROTECTED_STRATEGIC_TICKERS = Object.freeze([
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST", "VRT", "AXON",
  "DECK", "WING", "META", "APP", "MSFT", "GOOGL", "GOOG", "AVGO", "PLTR", "CRDO",
  "RKLB", "QCOM", "MU", "ARM", "DELL", "INTC", "MRVL", "HOOD", "COIN", "UBER",
] as const);

const protectedStrategicTickerSet = new Set<string>(PROTECTED_STRATEGIC_TICKERS);

export const PROTECTED_COMPANY_SQL_PREDICATE = Object.freeze(
  `(c.is_pilot = true OR c.ticker IN (${PROTECTED_STRATEGIC_TICKERS
    .map((ticker) => `'${ticker}'`)
    .join(", ")}))`,
);

export function isProtectedStrategicTicker(ticker: string): boolean {
  return protectedStrategicTickerSet.has(ticker.trim().toUpperCase());
}

export function isProtectedCompany(ticker: string, isPilot: boolean): boolean {
  return isPilot || isProtectedStrategicTicker(ticker);
}
