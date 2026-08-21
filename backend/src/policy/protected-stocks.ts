// TS: 2026-08-21 07:01 ET

export const PROTECTED_STRATEGIC_TICKERS = Object.freeze([
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST", "VRT", "AXON",
  "DECK", "WING", "META", "APP", "MSFT", "GOOGL", "GOOG", "AVGO", "PLTR", "CRDO",
  "RKLB", "QCOM", "MU", "ARM", "DELL", "INTC", "MRVL", "HOOD", "COIN", "UBER",
] as const);

const protectedStrategicTickerSet = new Set<string>(PROTECTED_STRATEGIC_TICKERS);

export function isProtectedStrategicTicker(ticker: string): boolean {
  return protectedStrategicTickerSet.has(ticker.trim().toUpperCase());
}
