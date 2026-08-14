// TS: 2026-08-14 12:17 ET

async function resolveHomeStockQuery(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return "";

  try {
    const response = await fetch("data/market-universe.json", { cache: "no-store" });
    if (response.ok) {
      const stocks = await response.json();
      const exactTicker = stocks.find(
        (stock) => String(stock.ticker || "").toLowerCase() === normalized,
      );
      if (exactTicker) return String(exactTicker.ticker).toUpperCase();

      const exactName = stocks.find(
        (stock) => String(stock.name || "").toLowerCase() === normalized,
      );
      if (exactName) return String(exactName.ticker).toUpperCase();

      const nameMatches = stocks.filter((stock) => {
        const name = String(stock.name || "").toLowerCase();
        return name.startsWith(normalized) || normalized.startsWith(name);
      });
      if (nameMatches.length === 1) {
        return String(nameMatches[0].ticker).toUpperCase();
      }
    }
  } catch (_error) {
    // Fall through to ticker-only handling if the local stock list is unavailable.
  }

  const raw = String(query || "").trim();
  const looksLikeTicker = raw === raw.toUpperCase() && /^[A-Z0-9.-]{1,15}$/.test(raw);
  return looksLikeTicker ? raw : "";
}

function startHomeStockFinder() {
  const form = document.querySelector("[data-home-stock-finder]");
  const input = document.querySelector("[data-home-stock-finder-input]");
  if (!form || !input) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const ticker = await resolveHomeStockQuery(query);
      const url = new URL(
        ticker ? "market-explorer.html" : "coverage-universe.html",
        window.location.href,
      );

      if (ticker) {
        url.searchParams.set("left", ticker);
        url.searchParams.set("mode", "single");
        url.searchParams.set("direct", "1");
      } else {
        url.searchParams.set("q", query);
      }

      window.location.href = url.toString();
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startHomeStockFinder);
} else {
  startHomeStockFinder();
}
