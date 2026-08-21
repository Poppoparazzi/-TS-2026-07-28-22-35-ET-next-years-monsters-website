// TS: 2026-08-21 16:32 UTC

function coverageText(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
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
    ? `${stock.sector} · Demonstration Monster Check · Not internally live`
    : `${stock.sector} · External chart and news coverage · No Monster Rating yet`;

  const primaryLink = document.createElement("a");
  if (mode === "demo") {
    primaryLink.href = `monster-check.html?ticker=${encodeURIComponent(stock.ticker)}`;
    primaryLink.textContent = "OPEN DEMONSTRATION MONSTER CHECK™ →";
  } else {
    primaryLink.href = `market-explorer.html?left=${encodeURIComponent(stock.ticker)}&mode=single`;
    primaryLink.textContent = "OPEN FULL CHART →";
  }

  const newsLink = document.createElement("a");
  newsLink.href = `news-radar.html?ticker=${encodeURIComponent(stock.ticker)}#current-stories`;
  newsLink.textContent = "OPEN CURRENT STORIES →";

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
    const response = await fetch("data/market-universe.json");
    if (!response.ok) throw new Error("Unable to load the market universe.");

    const stocks = await response.json();
    const ordered = [...stocks].sort((left, right) =>
      String(left.ticker).localeCompare(String(right.ticker)),
    );
    const demonstrations = ordered.filter((stock) => stock.monsterCheck);
    const externalOnly = ordered.filter((stock) => !stock.monsterCheck);

    renderCoverageGrid("[data-coverage-stock-grid]", demonstrations, "demo");
    renderCoverageGrid("[data-coverage-expansion-grid]", externalOnly, "external");

    coverageText("[data-coverage-demo-count]", String(demonstrations.length));
    coverageText("[data-coverage-external-count]", String(externalOnly.length));
    coverageText("[data-coverage-status]", `${ordered.length} MARKET TOOLS LOADED · CHECKING PRODUCTION DIRECTORY`);
  } catch (_error) {
    coverageText("[data-coverage-status]", "COVERAGE UNIVERSE COULD NOT LOAD");
    document.querySelectorAll("[data-coverage-stock-grid], [data-coverage-expansion-grid]").forEach((grid) => {
      grid.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "The coverage list could not be loaded. No stock was invented.";
      grid.append(message);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startCoverageUniverse);
} else {
  startCoverageUniverse();
}
