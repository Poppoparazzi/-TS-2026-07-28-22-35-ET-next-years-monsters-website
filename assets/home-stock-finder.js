// TS: 2026-08-21 16:32 UTC

function homeStockFinderApiBaseUrl() {
  const raw = window.NYM_CONFIG?.apiBaseUrl;
  if (typeof raw !== "string" || !raw.trim()) return "";

  try {
    const url = new URL(raw.trim());
    const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) return "";
    return url.href.replace(/\/$/, "");
  } catch (_error) {
    return "";
  }
}

function comparableCompanyName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}

async function searchProductionUniverse(query) {
  const apiBaseUrl = homeStockFinderApiBaseUrl();
  if (!apiBaseUrl) return [];

  const url = new URL(`${apiBaseUrl}/api/universe/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "12");
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) throw new Error("The production stock directory is unavailable.");
  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

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
  try {
    const matches = await searchProductionUniverse(raw);
    const normalizedTicker = raw.toUpperCase();
    const exactTicker = matches.find(
      (company) => String(company.ticker || "").toUpperCase() === normalizedTicker,
    );
    if (exactTicker) return String(exactTicker.ticker).toUpperCase();

    const normalizedName = comparableCompanyName(raw);
    const exactName = matches.find(
      (company) => comparableCompanyName(company.companyName) === normalizedName,
    );
    if (exactName) return String(exactName.ticker).toUpperCase();
    if (matches.length === 1) return String(matches[0].ticker || "").toUpperCase();
  } catch (_error) {
    // Exact ticker entry still works if the broad production directory is waking.
  }

  const normalizedTicker = raw.toUpperCase();
  return /^[A-Z0-9.-]{1,15}$/.test(normalizedTicker) ? normalizedTicker : "";
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
    const originalButtonText = submitButton?.textContent || "SEARCH STOCKS";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "SEARCHING…";
    }

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
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startHomeStockFinder);
} else {
  startHomeStockFinder();
}
