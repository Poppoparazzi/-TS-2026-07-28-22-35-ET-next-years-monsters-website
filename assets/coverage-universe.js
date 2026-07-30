// TS: 2026-07-30 06:58 ET

function coverageText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function renderCurrentStocks(stocks) {
  const grid = document.querySelector("[data-coverage-stock-grid]");
  if (!grid) return;

  grid.replaceChildren();
  stocks.forEach((stock) => {
    const card = document.createElement("article");
    card.className = "coverage-stock-card";

    const ticker = document.createElement("strong");
    ticker.textContent = `$${String(stock.ticker).toUpperCase()}`;

    const company = document.createElement("span");
    company.textContent = stock.name;

    const sector = document.createElement("small");
    sector.textContent = `${stock.sector} · Demonstration profile · Not internally live`;

    const link = document.createElement("a");
    link.href = `monster-check.html?ticker=${encodeURIComponent(stock.ticker)}`;
    link.textContent = "OPEN DEMONSTRATION MONSTER CHECK™ →";

    card.append(ticker, company, sector, link);
    grid.append(card);
  });
}

function renderOpenSlots(count) {
  const grid = document.querySelector("[data-coverage-slot-grid]");
  if (!grid) return;

  grid.replaceChildren();
  for (let index = 1; index <= count; index += 1) {
    const card = document.createElement("article");
    card.className = "coverage-slot-card";

    const slot = document.createElement("strong");
    slot.textContent = `SLOT ${String(index).padStart(2, "0")}`;

    const status = document.createElement("span");
    status.textContent = "COMPANY NOT SELECTED";

    card.append(slot, status);
    grid.append(card);
  }
}

async function startCoverageUniverse() {
  renderOpenSlots(10);

  try {
    const response = await fetch("data/stocks.json");
    if (!response.ok) throw new Error("Unable to load the current stock universe.");

    const stocks = await response.json();
    const ordered = [...stocks].sort((left, right) =>
      String(left.ticker).localeCompare(String(right.ticker)),
    );

    renderCurrentStocks(ordered);
    coverageText("[data-coverage-current-count]", String(ordered.length));
    coverageText("[data-coverage-status]", "15 DEMONSTRATION PROFILES LOADED");
  } catch (_error) {
    coverageText("[data-coverage-status]", "CURRENT UNIVERSE COULD NOT LOAD");
    const grid = document.querySelector("[data-coverage-stock-grid]");
    if (grid) {
      grid.replaceChildren();
      const message = document.createElement("p");
      message.textContent = "The current pilot list could not be loaded. No stock was invented.";
      grid.append(message);
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startCoverageUniverse);
} else {
  startCoverageUniverse();
}