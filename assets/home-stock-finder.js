// TS: 2026-08-04 22:18 ET

function startHomeStockFinder() {
  const form = document.querySelector("[data-home-stock-finder]");
  const input = document.querySelector("[data-home-stock-finder-input]");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const exactTicker = query.toUpperCase();
    const isExactTicker = /^[A-Z0-9.-]{1,15}$/.test(query) && !query.includes(" ");
    const url = new URL(
      isExactTicker ? "stock.html" : "coverage-universe.html",
      window.location.href,
    );
    if (isExactTicker) {
      url.searchParams.set("ticker", exactTicker);
    } else if (query) {
      url.searchParams.set("q", query);
    }
    window.location.href = url.toString();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startHomeStockFinder);
} else {
  startHomeStockFinder();
}
