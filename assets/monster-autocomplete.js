// TS: 2026-07-30 08:56 ET

function normalizeAutocompleteText(value) {
  return String(value ?? "").trim().toUpperCase();
}

function rankAutocompleteStocks(stocks, query) {
  const normalized = normalizeAutocompleteText(query);
  if (!normalized) return [];

  return stocks
    .map((stock) => {
      const ticker = normalizeAutocompleteText(stock.ticker);
      const name = normalizeAutocompleteText(stock.name);
      let rank = 99;

      if (ticker === normalized) rank = 0;
      else if (ticker.startsWith(normalized)) rank = 1;
      else if (name.startsWith(normalized)) rank = 2;
      else if (ticker.includes(normalized)) rank = 3;
      else if (name.includes(normalized)) rank = 4;

      return { stock, rank };
    })
    .filter(({ rank }) => rank < 99)
    .sort((left, right) =>
      left.rank - right.rank || left.stock.ticker.localeCompare(right.stock.ticker),
    )
    .slice(0, 8)
    .map(({ stock }) => stock);
}

function createAutocompleteRow(stock, input, runButton, closeList) {
  const row = document.createElement("div");
  row.className = "monster-autocomplete-row";
  row.setAttribute("role", "option");

  const checkButton = document.createElement("button");
  checkButton.type = "button";
  checkButton.className = "monster-autocomplete-check";
  checkButton.innerHTML = `
    <span class="monster-autocomplete-ticker">${stock.ticker}</span>
    <span class="monster-autocomplete-company">${stock.name}</span>
    <span class="monster-autocomplete-sector">${stock.sector || "U.S. stock"}</span>
    <strong>CHECK</strong>
  `;
  checkButton.setAttribute("aria-label", `Run Monster Check for ${stock.ticker}, ${stock.name}`);
  checkButton.addEventListener("click", () => {
    input.value = stock.ticker;
    closeList();
    runButton.click();
  });

  const chartLink = document.createElement("a");
  chartLink.className = "monster-autocomplete-chart";
  chartLink.href = `market-explorer.html?left=${encodeURIComponent(stock.ticker)}&mode=single`;
  chartLink.textContent = "CHART";
  chartLink.title = `Open ${stock.ticker} full chart`;
  chartLink.setAttribute("aria-label", `Open ${stock.ticker} full chart`);

  row.append(checkButton, chartLink);
  return row;
}

async function setupMonsterAutocomplete() {
  const input = document.querySelector("[data-ticker-input]");
  const runButton = document.querySelector("[data-rate-button]");
  const list = document.querySelector("[data-monster-autocomplete]");
  if (!input || !runButton || !list) return;

  let stocks = [];
  try {
    const response = await fetch("data/stocks.json");
    if (!response.ok) throw new Error("Stock list unavailable");
    stocks = await response.json();
  } catch (error) {
    list.hidden = true;
    return;
  }

  let activeIndex = -1;

  const closeList = () => {
    list.hidden = true;
    list.replaceChildren();
    activeIndex = -1;
    input.setAttribute("aria-expanded", "false");
  };

  const setActiveRow = (nextIndex) => {
    const rows = [...list.querySelectorAll(".monster-autocomplete-row")];
    if (!rows.length) return;

    activeIndex = (nextIndex + rows.length) % rows.length;
    rows.forEach((row, index) => row.classList.toggle("is-active", index === activeIndex));
    rows[activeIndex].querySelector(".monster-autocomplete-check")?.focus();
  };

  const renderMatches = () => {
    const query = input.value.trim();
    const matches = rankAutocompleteStocks(stocks, query);
    list.replaceChildren();
    activeIndex = -1;

    if (!query || !matches.length) {
      closeList();
      return;
    }

    matches.forEach((stock) => {
      list.append(createAutocompleteRow(stock, input, runButton, closeList));
    });

    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };

  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  input.addEventListener("input", renderMatches);
  input.addEventListener("focus", () => {
    if (input.value.trim() && document.activeElement === input) renderMatches();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && !list.hidden) {
      event.preventDefault();
      setActiveRow(activeIndex + 1);
    } else if (event.key === "Escape") {
      closeList();
    }
  });

  document.addEventListener("click", (event) => {
    if (!list.contains(event.target) && event.target !== input) closeList();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupMonsterAutocomplete);
} else {
  setupMonsterAutocomplete();
}
