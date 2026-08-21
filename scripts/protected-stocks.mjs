// TS: 2026-08-21 03:59 ET

export const protectedTickers = Object.freeze([
  "AAPL", "NVDA", "MNST", "AMZN", "TSLA", "NFLX", "AMD", "COST", "VRT", "AXON",
  "DECK", "WING", "META", "APP", "MSFT", "GOOGL", "GOOG", "AVGO", "PLTR", "CRDO",
  "RKLB", "QCOM", "MU", "ARM", "DELL", "INTC", "MRVL", "HOOD", "COIN", "UBER",
]);

const protectedTickerSet = new Set(protectedTickers);

export function isProtectedStock(company) {
  return company?.isPilot === true || protectedTickerSet.has(String(company?.ticker || "").toUpperCase());
}
