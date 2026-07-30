// TS: 2026-07-30 09:43 ET

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

function createCoverageFinderAction(className, href, label) {
  const link = document.createElement("a");
  link.className = className;
  link.href = href;
  link.textContent = label;
  return link;
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
  detail.textContent = stock.monsterCheck
    ? `${stock.sector} · Monster Check demonstration available · Not internally live`
    : `${stock.sector} · Charts and News available · No Monster Rating yet`;

  identity.append(ticker, company, detail);

  const actions = document.createElement("div");
  actions.className = "coverage-finder-actions";

  if (stock.monsterCheck) {
    actions.append(createCoverageFinderAction(
      "coverage-finder-check",
      `monster-check.html?ticker=${encodeURIComponent(stock.ticker)}`,
      "MONSTER CHECK",
    ));
  } else {
    const status = document.createElement("span");
    status.className = "coverage-finder-status";
    status.textContent = "NO RATING YET";
    actions.append(status);
  }

  actions.append(
    createCoverageFinderAction(
      "coverage-finder-chart",
      `market-explorer.html?left=${encodeURIComponent(stock.ticker)}&mode=single`,
      "CHART",
    ),
    createCoverageFinderAction(
      "coverage-finder-news",
      `news-radar.html?ticker=${encodeURIComponent(stock.ticker)}#current-stories`,
      "CURRENT STORIES",
    ),
  );

  card.append(identity, actions);
  return card;
}

async function startCoverageFinder() {
  const input = document.querySelector("[data-coverage-finder-input]");
  const clearButton = document.querySelector("[data-coverage-finder-clear]");
  const filters = [...document.querySelectorAll("[data-coverage-finder-filter]")];
  const summary = document.querySelector("[data-coverage-finder-summary]");
  const results = document.querySelector("[data-coverage-finder-results]");

  if (!input || !clearButton || !summary || !results) return;

  let stocks = [];
  let activeFilter = "all";

  try {
    const response = await fetch("data/market-universe.json");
    if (!response.ok) throw new Error("Unable to load market universe");
    stocks = await response.json();
  } catch (_error) {
    summary.textContent = "STOCK FINDER COULD NOT LOAD";
    results.innerHTML = '<p class="coverage-finder-empty">The market list could not be loaded. No company was invented.</p>';
    return;
  }

  const render = () => {
    const query = input.value.trim();
    const filtered = stocks
      .filter((stock) => {
        if (activeFilter === "monster") return stock.monsterCheck;
        if (activeFilter === "market") return !stock.monsterCheck;
        return true;
      })
      .filter((stock) => coverageFinderMatches(stock, query))
      .sort((left, right) => {
        const normalized = coverageFinderNormalize(query);
        const leftTicker = coverageFinderNormalize(left.ticker);
        const rightTicker = coverageFinderNormalize(right.ticker);
        const leftRank = leftTicker === normalized ? 0 : leftTicker.startsWith(normalized) ? 1 : 2;
        const rightRank = rightTicker === normalized ? 0 : rightTicker.startsWith(normalized) ? 1 : 2;
        return leftRank - rightRank || leftTicker.localeCompare(rightTicker);
      })
      .slice(0, 12);

    results.replaceChildren();

    if (!query) {
      summary.textContent = "TYPE A TICKER, COMPANY, OR SECTOR";
      const message = document.createElement("p");
      message.className = "coverage-finder-empty";
      message.textContent = "Try AAPL, Apple, RKLB, software, semiconductors, or financial technology. The finder is designed to scale without placing thousands of ticker buttons on the page.";
      results.append(message);
      return;
    }

    summary.textContent = `${filtered.length} MATCH${filtered.length === 1 ? "" : "ES"} SHOWN`;

    if (!filtered.length) {
      const message = document.createElement("p");
      message.className = "coverage-finder-empty";
      message.textContent = `No current Market 25 company matches “${query}.” The finder will expand as the coverage universe grows.`;
      results.append(message);
      return;
    }

    filtered.forEach((stock) => results.append(createCoverageFinderCard(stock)));
  };

  input.addEventListener("input", render);

  clearButton.addEventListener("click", () => {
    input.value = "";
    input.focus();
    render();
  });

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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startCoverageFinder);
} else {
  startCoverageFinder();
}
