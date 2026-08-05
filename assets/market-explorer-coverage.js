// 2026-07-30

function ensureExplorerCoverageUi(side) {
  const title = document.querySelector(`.explorer-chart-title:has([data-explorer-${side}-ticker])`);
  const actions = document.querySelector(`[data-explorer-${side}-monster-link]`)?.parentElement;
  if (!title || !actions) return null;

  let badge = title.querySelector(`[data-explorer-${side}-coverage]`);
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "explorer-coverage-badge";
    badge.dataset[`explorer${side[0].toUpperCase()}${side.slice(1)}Coverage`] = "";
    title.append(badge);
  }

  let coverageLink = actions.querySelector(`[data-explorer-${side}-coverage-link]`);
  if (!coverageLink) {
    coverageLink = document.createElement("a");
    coverageLink.className = "explorer-coverage-link";
    coverageLink.dataset[`explorer${side[0].toUpperCase()}${side.slice(1)}CoverageLink`] = "";
    actions.append(coverageLink);
  }

  return { badge, coverageLink, actions };
}

async function startExplorerCoverageLabels() {
  const leftSelect = document.querySelector("[data-explorer-left-select]");
  const rightSelect = document.querySelector("[data-explorer-right-select]");
  if (!leftSelect || !rightSelect) return;

  let stocks = [];
  try {
    const response = await fetch(window.NYM_STATIC_URL?.("data/market-universe.json") || "data/market-universe.json");
    if (!response.ok) throw new Error("Market universe unavailable");
    stocks = await response.json();
  } catch (_error) {
    return;
  }

  const byTicker = new Map(
    stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]),
  );

  const updateSide = (side) => {
    const select = side === "left" ? leftSelect : rightSelect;
    const stock = byTicker.get(String(select.value).toUpperCase());
    const ui = ensureExplorerCoverageUi(side);
    const researchLink = document.querySelector(`[data-explorer-${side}-monster-link]`);
    if (!stock || !ui) return;

    ui.badge.classList.toggle("is-monster-check", Boolean(stock.monsterCheck));
    ui.badge.classList.toggle("is-market-only", !stock.monsterCheck);

    if (stock.monsterCheck) {
      ui.badge.textContent = "MONSTER CHECK DEMONSTRATION AVAILABLE · NOT INTERNALLY LIVE";
      ui.coverageLink.href = "coverage-universe.html#current-universe-title";
      ui.coverageLink.textContent = "SEE COVERAGE STATUS";
      ui.coverageLink.setAttribute("aria-label", `See ${stock.ticker} coverage status`);
    } else {
      ui.badge.textContent = "CHARTS & NEWS ONLY · NO MONSTER RATING YET";
      ui.coverageLink.href = "coverage-universe.html#external-market-coverage";
      ui.coverageLink.textContent = "WHY NO RATING YET?";
      ui.coverageLink.setAttribute("aria-label", `Learn why ${stock.ticker} has no Monster Rating yet`);

      if (researchLink) {
        researchLink.href = `news-radar.html?ticker=${encodeURIComponent(stock.ticker)}#current-stories`;
        researchLink.textContent = `OPEN ${stock.ticker} CURRENT STORIES`;
      }
    }
  };

  const updateAll = () => {
    updateSide("left");
    updateSide("right");
  };

  leftSelect.addEventListener("change", () => window.setTimeout(() => updateSide("left"), 0));
  rightSelect.addEventListener("change", () => window.setTimeout(() => updateSide("right"), 0));

  const optionObserver = new MutationObserver(updateAll);
  optionObserver.observe(leftSelect, { childList: true });
  optionObserver.observe(rightSelect, { childList: true });

  window.setTimeout(updateAll, 0);
  window.setTimeout(updateAll, 350);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startExplorerCoverageLabels);
} else {
  startExplorerCoverageLabels();
}
