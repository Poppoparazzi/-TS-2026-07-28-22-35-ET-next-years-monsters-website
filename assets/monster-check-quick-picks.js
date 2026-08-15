// TS: 2026-08-15 09:32 ET

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

  function normalizeTicker(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
  }

  function directChartUrl(ticker) {
    return `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single&direct=1`;
  }

  function runTicker(ticker) {
    const input = document.querySelector("[data-ticker-input]");
    const button = document.querySelector("[data-rate-button]");
    if (!input || !button) return;

    input.value = ticker;
    button.click();
  }

  function tickerForSuggestionItem(item) {
    if (item.matches("button.chip")) return normalizeTicker(item.textContent);
    const button = item.querySelector?.("button.chip");
    return button ? normalizeTicker(button.textContent) : "";
  }

  function enforceQuickPickIntegrity() {
    const suggestions = document.querySelector("[data-suggestions]");
    if (!suggestions) return;

    const seen = new Set();
    [...suggestions.children].forEach((item) => {
      const ticker = tickerForSuggestionItem(item);
      if (!ticker || !VCL_TICKERS.includes(ticker)) return;

      if (seen.has(ticker)) {
        item.remove();
        return;
      }
      seen.add(ticker);
    });

    suggestions.querySelectorAll(".monster-shortcut-chart").forEach((link) => {
      const wrapper = link.closest(".monster-stock-shortcut");
      const ticker = tickerForSuggestionItem(wrapper || link.parentElement);
      if (!ticker) return;
      link.href = directChartUrl(ticker);
      link.title = `Open ${ticker} chart directly`;
      link.setAttribute("aria-label", `Open ${ticker} chart directly`);
    });
  }

  function enforceResultChartLink() {
    document.querySelectorAll("[data-monster-result-chart-link]").forEach((link) => {
      try {
        const url = new URL(link.href, window.location.href);
        url.searchParams.set("direct", "1");
        link.href = url.toString();
      } catch (_error) {
        // Leave an already-invalid link untouched rather than inventing a destination.
      }
    });
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

    enforceQuickPickIntegrity();

    const suggestionsObserver = new MutationObserver(() => {
      window.requestAnimationFrame(enforceQuickPickIntegrity);
    });
    suggestionsObserver.observe(suggestions, { childList: true, subtree: true });

    const result = document.querySelector("[data-result]");
    if (result) {
      const resultObserver = new MutationObserver(() => {
        window.requestAnimationFrame(enforceResultChartLink);
      });
      resultObserver.observe(result, { childList: true, subtree: true });
    }

    document.addEventListener(
      "click",
      (event) => {
        const link = event.target.closest?.(
          ".monster-shortcut-chart, [data-monster-result-chart-link]",
        );
        if (!link) return;

        try {
          const url = new URL(link.href, window.location.href);
          url.searchParams.set("direct", "1");
          link.href = url.toString();
        } catch (_error) {
          // The normal browser behavior remains if the destination cannot be parsed.
        }
      },
      true,
    );

    window.requestAnimationFrame(() => {
      enforceQuickPickIntegrity();
      enforceResultChartLink();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderQuickPicks);
  } else {
    renderQuickPicks();
  }
})();
