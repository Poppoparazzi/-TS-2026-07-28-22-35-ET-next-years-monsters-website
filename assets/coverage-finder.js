// TS: 2026-08-21 16:32 UTC

function coverageFinderNormalize(value) {
  return String(value ?? "").trim().toUpperCase();
}

function coverageFinderMatches(stock, query) {
  const normalized = coverageFinderNormalize(query);
  if (!normalized) return true;

  return [stock.ticker, stock.name, stock.sector]
    .map(coverageFinderNormalize)
    .some((value) => value.includes(normalized));
}

function coverageFinderApiBaseUrl() {
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

async function loadProductionDirectory(query, evidenceReadyOnly = false) {
  const apiBaseUrl = coverageFinderApiBaseUrl();
  if (!apiBaseUrl) throw new Error("The production directory is not configured.");

  const url = new URL(`${apiBaseUrl}/api/universe/search`);
  if (query) url.searchParams.set("q", query);
  url.searchParams.set("limit", "25");
  if (evidenceReadyOnly) url.searchParams.set("evidenceReady", "true");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) throw new Error("The production directory did not respond.");
  return response.json();
}

function createCoverageFinderAction(className, href, label) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
}

function productionStatusLabel(stock) {
  if (stock.status === "evidence_ready" || stock.secEvidenceReady) return "SEC EVIDENCE READY";
  if (stock.status === "protected_must_repair") return "PROTECTED · REPAIRING";
  if (stock.status === "replaceable_exception") return "ORDINARY EXCEPTION";
  if (stock.status === "processing") return "EVIDENCE PROCESSING";
  return stock.production ? "EVIDENCE PENDING" : "MARKET TOOLS";
}

function productionDetail(stock) {
  const location = stock.exchange || stock.sector || "Official SEC company";
  if (stock.monsterCheck) {
    return `${stock.sector} · Educational Monster Check demonstration available`;
  }
  if (stock.secEvidenceReady) {
    return `${location} · Required SEC evidence is ready · Current rating awaits market data`;
  }
  if (stock.status === "protected_must_repair") {
    return `${location} · Strategic ticker remains on the mandatory evidence-repair path`;
  }
  if (stock.status === "replaceable_exception") {
    return `${location} · Ordinary SEC exception · No rating will be invented`;
  }
  return `${location} · Official production-universe candidate · Evidence is not complete`;
}

function createCoverageFinderCard(stock) {
  const card = document.createElement("article");
  card.className = "coverage-finder-card";

  const identity = document.createElement("div");
  identity.className = "coverage-finder-identity";

  const ticker = document.createElement("strong");
  ticker.textContent = `$${String(stock.ticker).toUpperCase()}`;

  const company = document.createElement("span");
  company.textContent = stock.name;

  const detail = document.createElement("small");
  detail.textContent = productionDetail(stock);

  identity.append(ticker, company, detail);

  const actions = document.createElement("div");
  actions.className = "coverage-finder-actions";

  const status = document.createElement("span");
  status.className = `coverage-finder-status coverage-finder-status-${stock.status || "market"}`;
  status.textContent = productionStatusLabel(stock);
  actions.append(status);

  actions.append(
    createCoverageFinderAction(
      "coverage-finder-check",
      `monster-check.html?ticker=${encodeURIComponent(stock.ticker)}`,
      stock.monsterCheck ? "MONSTER CHECK" : "STOCK CHECK",
    ),
    createCoverageFinderAction(
      "coverage-finder-chart",
      `market-explorer.html?left=${encodeURIComponent(stock.ticker)}&mode=single&direct=1`,
      "CHART",
    ),
  );

  if (stock.marketTools) {
    actions.append(createCoverageFinderAction(
      "coverage-finder-news",
      `news-radar.html?ticker=${encodeURIComponent(stock.ticker)}#current-stories`,
      "CURRENT STORIES",
    ));
  }

  card.append(identity, actions);
  return card;
}

function localDirectoryStock(stock) {
  return {
    ...stock,
    name: stock.name,
    exchange: stock.exchange || "",
    production: false,
    secEvidenceReady: false,
    ratingAvailable: false,
    status: "market",
    marketTools: true,
  };
}

function productionDirectoryStock(company, localStock) {
  return {
    ticker: company.ticker,
    name: company.companyName,
    exchange: company.exchange || "",
    sector: localStock?.sector || company.exchange || "Official SEC company",
    monsterCheck: Boolean(localStock?.monsterCheck),
    marketTools: Boolean(localStock),
    production: true,
    secEvidenceReady: Boolean(company.secEvidenceReady),
    ratingAvailable: Boolean(company.ratingAvailable),
    isProtected: Boolean(company.isProtected),
    status: company.status || "reserve",
  };
}

function coverageFinderRank(stock, query) {
  const normalized = coverageFinderNormalize(query);
  const ticker = coverageFinderNormalize(stock.ticker);
  const name = coverageFinderNormalize(stock.name);
  if (ticker === normalized) return 0;
  if (name === normalized) return 1;
  if (ticker.startsWith(normalized)) return 2;
  if (name.startsWith(normalized)) return 3;
  return 4;
}

function updateProductionDirectoryTotals(universe) {
  if (!universe) return;

  coverageText("[data-coverage-candidate-count]", Number(universe.candidateCount || 0).toLocaleString());
  coverageText("[data-coverage-evidence-count]", Number(universe.secEvidenceReadyCount || 0).toLocaleString());
  coverageText("[data-coverage-protected-count]", Number(universe.protectedTickerCount || 0).toLocaleString());
  coverageText("[data-coverage-exception-count]", Number(universe.replaceableFailureCount || 0).toLocaleString());
  coverageText(
    "[data-coverage-status]",
    Number(universe.protectedMustRepairCount || 0) === 0
      ? "LIVE · PROTECTED STOCKS READY"
      : `${Number(universe.protectedMustRepairCount).toLocaleString()} PROTECTED REPAIRS ACTIVE`,
  );

  document.querySelectorAll("[data-coverage-all-label]").forEach((node) => {
    node.textContent = `ALL ${Number(universe.candidateCount || 0).toLocaleString()}`;
  });
}

async function startCoverageFinder() {
  const input = document.querySelector("[data-coverage-finder-input]");
  const clearButton = document.querySelector("[data-coverage-finder-clear]");
  const filters = [...document.querySelectorAll("[data-coverage-finder-filter]")];
  const summary = document.querySelector("[data-coverage-finder-summary]");
  const results = document.querySelector("[data-coverage-finder-results]");

  if (!input || !clearButton || !summary || !results) return;

  const initialParams = new URLSearchParams(window.location.search);
  input.value = initialParams.get("q") || "";

  let localStocks = [];
  let activeFilter = "all";
  let requestGeneration = 0;
  let searchTimer = null;

  try {
    const response = await fetch("data/market-universe.json");
    if (!response.ok) throw new Error("Unable to load market universe");
    localStocks = (await response.json()).map(localDirectoryStock);
  } catch (_error) {
    localStocks = [];
  }

  const byLocalTicker = new Map(
    localStocks.map((stock) => [coverageFinderNormalize(stock.ticker), stock]),
  );

  const syncQueryToUrl = () => {
    const url = new URL(window.location.href);
    const query = input.value.trim();
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url);
  };

  const emptyResults = (message) => {
    results.replaceChildren();
    const node = document.createElement("p");
    node.className = "coverage-finder-empty";
    node.textContent = message;
    results.append(node);
  };

  const renderSearch = async () => {
    const query = input.value.trim();
    const generation = ++requestGeneration;

    if (!query) {
      summary.textContent = "TYPE A TICKER, COMPANY, OR INDUSTRY";
      emptyResults("Search the live production universe by ticker or company name. Industry searches continue to use the curated market-tool collection.");
      return;
    }

    if (activeFilter === "monster") {
      const demonstrations = localStocks
        .filter((stock) => stock.monsterCheck && coverageFinderMatches(stock, query))
        .sort((left, right) => coverageFinderRank(left, query) - coverageFinderRank(right, query));
      summary.textContent = `${demonstrations.length} DEMONSTRATION MATCH${demonstrations.length === 1 ? "" : "ES"}`;
      results.replaceChildren();
      if (!demonstrations.length) {
        emptyResults(`No educational Monster Check demonstration matches “${query}.” Try the All 5,000 filter for the production universe.`);
      } else {
        demonstrations.forEach((stock) => results.append(createCoverageFinderCard(stock)));
      }
      return;
    }

    summary.textContent = activeFilter === "evidence"
      ? "SEARCHING SEC EVIDENCE-READY COMPANIES…"
      : "SEARCHING THE 5,000-CANDIDATE PRODUCTION UNIVERSE…";

    const localMatches = activeFilter === "all"
      ? localStocks.filter((stock) => coverageFinderMatches(stock, query))
      : [];

    try {
      const payload = await loadProductionDirectory(query, activeFilter === "evidence");
      if (generation !== requestGeneration) return;
      updateProductionDirectoryTotals(payload.universe);

      const merged = new Map();
      (payload.results || []).forEach((company) => {
        const key = coverageFinderNormalize(company.ticker);
        merged.set(key, productionDirectoryStock(company, byLocalTicker.get(key)));
      });
      localMatches.forEach((stock) => {
        const key = coverageFinderNormalize(stock.ticker);
        if (!merged.has(key)) merged.set(key, stock);
      });

      const matches = [...merged.values()]
        .sort((left, right) => {
          return coverageFinderRank(left, query) - coverageFinderRank(right, query)
            || coverageFinderNormalize(left.ticker).localeCompare(coverageFinderNormalize(right.ticker));
        })
        .slice(0, 12);

      results.replaceChildren();
      summary.textContent = matches.length
        ? `${matches.length} BEST MATCH${matches.length === 1 ? "" : "ES"} SHOWN`
        : "NO MATCHES FOUND";

      if (!matches.length) {
        emptyResults(`No active production-universe company matches “${query}.” Try an exact U.S. ticker or a shorter company name.`);
      } else {
        matches.forEach((stock) => results.append(createCoverageFinderCard(stock)));
      }
    } catch (_error) {
      if (generation !== requestGeneration) return;
      const fallback = localMatches
        .sort((left, right) => coverageFinderRank(left, query) - coverageFinderRank(right, query))
        .slice(0, 12);
      results.replaceChildren();
      summary.textContent = fallback.length
        ? `${fallback.length} CURATED MATCH${fallback.length === 1 ? "" : "ES"} · PRODUCTION DIRECTORY WAKING`
        : "PRODUCTION DIRECTORY IS WAKING · PLEASE TRY AGAIN SHORTLY";
      if (fallback.length) fallback.forEach((stock) => results.append(createCoverageFinderCard(stock)));
      else emptyResults("The production directory is temporarily unavailable. Please try the ticker or company again shortly; no result was invented.");
    }
  };

  const scheduleSearch = (immediate = false) => {
    if (searchTimer) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => void renderSearch(), immediate ? 0 : 300);
  };

  input.addEventListener("input", () => {
    syncQueryToUrl();
    scheduleSearch();
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    input.focus();
    syncQueryToUrl();
    scheduleSearch(true);
  });

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.coverageFinderFilter || "all";
      filters.forEach((item) => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      scheduleSearch(true);
    });
  });

  try {
    const payload = await loadProductionDirectory("");
    updateProductionDirectoryTotals(payload.universe);
  } catch (_error) {
    coverageText("[data-coverage-status]", "PRODUCTION DIRECTORY WAKING");
  }

  scheduleSearch(true);
  if (input.value) window.setTimeout(() => input.scrollIntoView({ block: "center" }), 100);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startCoverageFinder);
} else {
  startCoverageFinder();
}
