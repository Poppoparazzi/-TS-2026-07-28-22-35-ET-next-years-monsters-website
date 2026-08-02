// TS: 2026-08-02 09:46 ET

(function installMonsterCheckQuickPicks() {
  "use strict";

  const VCL_TICKERS = Object.freeze([
    "AAPL",
    "NVDA",
    "MNST",
    "AMZN",
    "TSLA",
    "NFLX",
    "AMD",
    "COST",
    "VRT",
    "AXON",
    "DECK",
    "WING",
    "META",
    "APP",
    "MSFT",
  ]);

  function runTicker(ticker) {
    const input = document.querySelector("[data-ticker-input]");
    const button = document.querySelector("[data-rate-button]");
    if (!input || !button) return;

    input.value = ticker;
    button.click();
  }

  function renderQuickPicks() {
    const suggestions = document.querySelector("[data-suggestions]");
    if (!suggestions || suggestions.dataset.launchQuickPicksReady === "true") return;

    suggestions.dataset.launchQuickPicksReady = "true";
    suggestions.innerHTML = "";

    VCL_TICKERS.forEach((ticker) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.textContent = ticker;
      button.title = `Run the ${ticker} Monster Check`;
      button.setAttribute("aria-label", `Run Monster Check for ${ticker}`);
      button.addEventListener("click", () => runTicker(ticker));
      suggestions.append(button);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderQuickPicks);
  } else {
    renderQuickPicks();
  }
})();
