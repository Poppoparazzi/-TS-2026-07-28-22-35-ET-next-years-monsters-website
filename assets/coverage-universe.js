// TS: 2026-08-04 11:44 ET

function coverageText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = String(value);
}

function createCoverageCard(stock, mode) {
  const card = document.createElement("article");
  card.className = "coverage-stock-card";

  const ticker = document.createElement("strong");
  ticker.textContent = `$${String(stock.ticker).toUpperCase()}`;

  const company = document.createElement("span");
  company.textContent = stock.name;

  const sector = document.createElement("small");
  sector.textContent = mode === "demo"
    ? `${stock.sector} · Demonstration Rating · External Market Data May Be Delayed`
    : `${stock.sector} · External Market Data May Be Delayed · Not Yet Rated`;

  const primaryLink = document.createElement("a");
  primaryLink.href = `stock.html?ticker=${encodeURIComponent(stock.ticker)}`;
  primaryLink.textContent = "OPEN STOCK PAGE →";

  const newsLink = document.createElement("a");
  newsLink.href = `news-radar.html?ticker=${encodeURIComponent(stock.ticker)}#current-stories`;
  newsLink.textContent = "OPEN EXTERNAL STORIES →";

  card.append(ticker, company, sector, primaryLink, newsLink);
  return card;
}

function renderCoverageGrid(selector, stocks, mode) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  grid.replaceChildren();
  stocks.forEach((stock) => grid.append(createCoverageCard(stock, mode)));
}

async function startCoverageUniverse() {
  try {
    const response = await fetch(window.NYM_STATIC_URL?.("data/market-universe.json") || "data/market-universe.json");
    if (!response.ok) throw new Error("Unable to load the Market 25 list.");

    const stocks = await response.json();
    const ordered = [...stocks].sort((left, right) => String(left.ticker).localeCompare(String(right.ticker)));
    const demonstrations = ordered.filter((stock) => stock.monsterCheck);
    const externalOnly = ordered.filter((stock) => !stock.monsterCheck);

    renderCoverageGrid("[data-coverage-stock-grid]", demonstrations, "demo");
    renderCoverageGrid("[data-coverage-expansion-grid]", externalOnly, "external");
    coverageText("[data-coverage-demo-count]", demonstrations.length);
  } catch (_error) {
    document.querySelectorAll("[data-coverage-stock-grid], [data-coverage-expansion-grid]").forEach((grid) => {
      grid.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "The external Market 25 list could not be loaded. Production SEC coverage remains a separate service.";
      grid.append(message);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startCoverageUniverse);
} else {
  startCoverageUniverse();
}
