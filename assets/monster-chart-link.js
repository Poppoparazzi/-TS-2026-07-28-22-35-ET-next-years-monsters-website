// TS: 2026-07-30 08:48 ET

function normalizeMonsterTicker(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "");
}

function addMonsterResultChartLink() {
  const result = document.querySelector("[data-result]");
  const identity = result?.querySelector(".monster-result-identity");
  const tickerNode = identity?.querySelector("h2 span");
  if (!identity || !tickerNode) return;

  const ticker = normalizeMonsterTicker(tickerNode.textContent);
  if (!ticker) return;

  let link = identity.querySelector("[data-monster-result-chart-link]");
  if (!link) {
    link = document.createElement("a");
    link.className = "home-btn home-btn-black monster-result-chart-link";
    link.dataset.monsterResultChartLink = "";
    identity.append(link);
  }

  link.href = `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single`;
  link.textContent = `OPEN ${ticker} FULL CHART →`;
  link.setAttribute("aria-label", `Open ${ticker} in the full single-chart view`);
}

function pairMonsterShortcutCharts() {
  const suggestions = document.querySelector("[data-suggestions]");
  if (!suggestions) return;

  const buttons = suggestions.querySelectorAll(
    ":scope > button.chip:not([data-monster-shortcut-paired])",
  );

  buttons.forEach((button) => {
    const ticker = normalizeMonsterTicker(button.textContent);
    if (!ticker) return;

    button.dataset.monsterShortcutPaired = "";
    button.classList.add("monster-shortcut-check");
    button.textContent = ticker;
    button.title = `Run the ${ticker} Monster Check`;
    button.setAttribute("aria-label", `Run Monster Check for ${ticker}`);

    const wrapper = document.createElement("span");
    wrapper.className = "monster-stock-shortcut";

    const chartLink = document.createElement("a");
    chartLink.className = "monster-shortcut-chart";
    chartLink.href = `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single`;
    chartLink.textContent = "CHART";
    chartLink.title = `Open ${ticker} full chart`;
    chartLink.setAttribute("aria-label", `Open ${ticker} full chart`);

    wrapper.append(button, chartLink);
    suggestions.append(wrapper);
  });
}

function startMonsterChartLinks() {
  const result = document.querySelector("[data-result]");
  const suggestions = document.querySelector("[data-suggestions]");

  addMonsterResultChartLink();
  pairMonsterShortcutCharts();

  if (result) {
    const resultObserver = new MutationObserver(() => {
      window.requestAnimationFrame(addMonsterResultChartLink);
    });

    resultObserver.observe(result, {
      childList: true,
      subtree: true,
    });
  }

  if (suggestions) {
    const suggestionObserver = new MutationObserver(() => {
      window.requestAnimationFrame(pairMonsterShortcutCharts);
    });

    suggestionObserver.observe(suggestions, {
      childList: true,
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMonsterChartLinks);
} else {
  startMonsterChartLinks();
}