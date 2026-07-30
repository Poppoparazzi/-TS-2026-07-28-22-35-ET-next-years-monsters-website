// TS: 2026-07-30 11:43 ET

function startHomeStockFinder() {
  const form = document.querySelector("[data-home-stock-finder]");
  const input = document.querySelector("[data-home-stock-finder-input]");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const url = new URL("coverage-universe.html", window.location.href);
    if (query) url.searchParams.set("q", query);
    window.location.href = url.toString();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startHomeStockFinder);
} else {
  startHomeStockFinder();
}
