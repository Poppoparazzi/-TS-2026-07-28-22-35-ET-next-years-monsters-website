// TS: 2026-07-30 08:29 ET

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

function startMonsterChartLink() {
  const result = document.querySelector("[data-result]");
  if (!result) return;

  addMonsterResultChartLink();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(addMonsterResultChartLink);
  });

  observer.observe(result, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMonsterChartLink);
} else {
  startMonsterChartLink();
}
