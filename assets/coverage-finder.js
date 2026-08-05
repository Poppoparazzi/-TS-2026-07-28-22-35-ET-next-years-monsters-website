// TS: 2026-08-04 22:18 ET

(() => {
  "use strict";

  const FACTORY_LIMIT = 2000;

  function apiBaseUrl() {
    const raw = window.NYM_CONFIG?.apiBaseUrl;
    if (typeof raw !== "string" || !raw.trim()) return null;
    try {
      const url = new URL(raw.trim());
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !local) return null;
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return null;
    }
  }

  function normalize(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = String(value);
  }

  function statusLabel(company) {
    if (company.secStage === "complete") return "OFFICIAL SEC EVIDENCE · COMPLETE";
    if (company.secStage === "unresolved") return "UNRESOLVED SEC IDENTITY";
    if (company.secStage === "failed") return "SEC CHECK FAILED";
    if (company.secStage === "processing") return "SEC CHECK IN BATCH";
    return "OFFICIAL SEC EVIDENCE · NOT YET COMPLETE";
  }

  function createAction(className, href, label) {
    const link = document.createElement("a");
    link.className = className;
    link.href = href;
    link.textContent = label;
    return link;
  }

  function createCard(company, demonstrationTickers) {
    const tickerValue = normalize(company.ticker);
    const hasDemo = demonstrationTickers.has(tickerValue);
    const card = document.createElement("article");
    card.className = "coverage-finder-card";

    const identity = document.createElement("div");
    identity.className = "coverage-finder-identity";

    const ticker = document.createElement("strong");
    ticker.textContent = `$${tickerValue}`;

    const name = document.createElement("span");
    name.textContent = company.companyName || "Company name unavailable";

    const detail = document.createElement("small");
    detail.textContent = `${statusLabel(company)} · ${hasDemo ? "Demonstration Rating Available" : "Not Yet Rated"}`;
    identity.append(ticker, name, detail);

    const actions = document.createElement("div");
    actions.className = "coverage-finder-actions";
    actions.append(
      createAction("coverage-finder-check", `stock.html?ticker=${encodeURIComponent(tickerValue)}`, "OPEN STOCK PAGE"),
      createAction("coverage-finder-chart", `market-explorer.html?left=${encodeURIComponent(tickerValue)}&mode=single`, "EXTERNAL CHART"),
    );

    card.append(identity, actions);
    return card;
  }

  async function requestJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    return payload;
  }

  async function loadDemoTickers() {
    try {
      const response = await fetch(window.NYM_STATIC_URL?.("data/market-universe.json") || "data/market-universe.json");
      if (!response.ok) return new Set();
      const stocks = await response.json();
      return new Set(stocks.filter((stock) => stock.monsterCheck).map((stock) => normalize(stock.ticker)));
    } catch (_error) {
      return new Set();
    }
  }

  async function startCoverageFinder() {
    const input = document.querySelector("[data-coverage-finder-input]");
    const clearButton = document.querySelector("[data-coverage-finder-clear]");
    const filters = [...document.querySelectorAll("[data-coverage-finder-filter]")];
    const summary = document.querySelector("[data-coverage-finder-summary]");
    const results = document.querySelector("[data-coverage-finder-results]");
    if (!input || !clearButton || !summary || !results) return;

    const baseUrl = apiBaseUrl();
    if (!baseUrl) {
      summary.textContent = "PROVIDER NOT CONNECTED";
      results.innerHTML = '<p class="coverage-finder-empty">The public API address is unavailable. No coverage result was invented.</p>';
      setText("[data-coverage-status]", "API UNAVAILABLE");
      return;
    }

    const initialParams = new URLSearchParams(window.location.search);
    input.value = initialParams.get("q") || "";
    let companies = [];
    let demonstrationTickers = new Set();
    let activeFilter = "all";

    try {
      const [payload, demos] = await Promise.all([
        requestJson(`${baseUrl}/api/universe/status?limit=${FACTORY_LIMIT}`),
        loadDemoTickers(),
      ]);
      companies = Array.isArray(payload.companies) ? payload.companies : [];
      demonstrationTickers = demos;
      setText("[data-coverage-market-count]", companies.length);
      setText("[data-coverage-sec-count]", payload.secCompleteCount ?? 0);
      setText("[data-coverage-unresolved-count]", payload.unresolvedCount ?? 0);
      setText("[data-coverage-status]", companies.length ? "LIVE API CONNECTED" : "NO COMPANIES RETURNED");
    } catch (error) {
      summary.textContent = "PRODUCTION COVERAGE COULD NOT LOAD";
      results.innerHTML = `<p class="coverage-finder-empty">${error instanceof Error ? error.message : "The production endpoint could not be reached."} No company status was invented.</p>`;
      setText("[data-coverage-status]", "API UNAVAILABLE");
      return;
    }

    const syncQuery = () => {
      const url = new URL(window.location.href);
      const query = input.value.trim();
      if (query) url.searchParams.set("q", query);
      else url.searchParams.delete("q");
      window.history.replaceState({}, "", url);
    };

    const render = () => {
      const query = input.value.trim();
      results.replaceChildren();
      if (!query) {
        summary.textContent = `${companies.length} PUBLIC COMPANIES LOADED · TYPE A TICKER OR COMPANY`;
        const message = document.createElement("p");
        message.className = "coverage-finder-empty";
        message.textContent = "Try AAPL, NVDA, IBM, or RKLB. Results come from the live production factory.";
        results.append(message);
        return;
      }

      const matched = companies
        .filter((company) => activeFilter === "all" || company.secStage === activeFilter)
        .map((company) => ({ company, rank: window.NYM_SEARCH_RANK?.rank(company, query) ?? Number.POSITIVE_INFINITY }))
        .filter(({ rank }) => Number.isFinite(rank))
        .sort((left, right) => {
          return window.NYM_SEARCH_RANK.compare(left.company, right.company, query);
        });
      const visible = matched.slice(0, 20).map(({ company }) => company);

      summary.textContent = matched.length > visible.length
        ? `${matched.length} MATCHES · SHOWING THE BEST ${visible.length}`
        : `${matched.length} MATCH${matched.length === 1 ? "" : "ES"}`;
      if (!visible.length) {
        const message = document.createElement("p");
        message.className = "coverage-finder-empty";
        message.textContent = `No public production company matches “${query}” under the selected evidence filter.`;
        results.append(message);
        return;
      }
      visible.forEach((company) => results.append(createCard(company, demonstrationTickers)));
    };

    input.addEventListener("input", () => { syncQuery(); render(); });
    clearButton.addEventListener("click", () => { input.value = ""; input.focus(); syncQuery(); render(); });
    filters.forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.coverageFinderFilter || "all";
        filters.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        render();
      });
    });

    render();
    if (input.value) window.setTimeout(() => input.scrollIntoView({ block: "center" }), 100);
  }

  document.addEventListener("DOMContentLoaded", () => void startCoverageFinder());
})();
