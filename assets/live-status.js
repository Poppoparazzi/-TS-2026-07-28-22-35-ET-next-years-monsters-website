// TS: 2026-08-05 07:38 UTC

(() => {
  "use strict";

  const config = window.NYM_CONFIG ?? {};
  const exchangeOverrides = Object.freeze({ DECK: "NYSE", VRT: "NYSE" });

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function apiBaseUrl() {
    const raw = typeof config.apiBaseUrl === "string" ? config.apiBaseUrl.trim() : "";
    if (!raw) return null;
    try {
      const url = new URL(raw);
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !local) return null;
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return null;
    }
  }

  function formatTimestamp(value) {
    if (!value) return "No verified update time";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Update time unavailable";
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(date);
  }

  function statusCheck(label, ready, detail) {
    return `<div class="status-check ${ready ? "status-check-ready" : "status-check-pending"}">
      <span aria-hidden="true">${ready ? "✓" : "○"}</span>
      <div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div>
    </div>`;
  }

  function emptyReadiness() {
    return {
      hasVerifiedQuote: false,
      quoteIsUsable: false,
      hasSecStatus: false,
      hasSavedVersionedRating: false,
      hasRatingEvidence: false,
      isLiveReady: false,
      lastSuccessfulUpdate: null,
    };
  }

  function statusRow(stock, index, readiness) {
    const company = readiness ?? emptyReadiness();
    const quoteReady = Boolean(company.hasVerifiedQuote && company.quoteIsUsable);
    const ratingReady = Boolean(company.hasSavedVersionedRating && company.hasRatingEvidence);
    const secReady = Boolean(company.hasSecStatus);

    const quoteDetail = quoteReady
      ? `Stored · ${formatTimestamp(company.lastSuccessfulUpdate)}`
      : "Provider Not Connected or no usable licensed quote confirmed";
    const secDetail = secReady ? "Official SEC Evidence confirmed" : "Unresolved SEC Identity or status unavailable";
    const ratingDetail = ratingReady ? "Versioned production rating and evidence confirmed" : "Not Yet Rated";
    const resultTitle = company.isLiveReady ? "PRODUCTION DATA CONFIRMED" : "CURRENT STATUS INCOMPLETE";
    const resultDetail = company.isLiveReady
      ? formatTimestamp(company.lastSuccessfulUpdate)
      : "The Demonstration Rating remains separate from current production status.";

    return `<article class="status-row">
      <div class="status-company">
        <strong>${String(index + 1).padStart(2, "0")} · $${escapeHtml(stock.ticker)}</strong>
        <span>${escapeHtml(stock.name)} · ${escapeHtml(stock.sector)}</span>
      </div>
      ${statusCheck("DEMONSTRATION RATING", true, "Historical educational material published")}
      ${statusCheck("LICENSED QUOTE", quoteReady, quoteDetail)}
      ${statusCheck("OFFICIAL SEC EVIDENCE", secReady, secDetail)}
      ${statusCheck("PRODUCTION MONSTER RATING™", ratingReady, ratingDetail)}
      <div class="status-result"><strong>${escapeHtml(resultTitle)}</strong><span>${escapeHtml(resultDetail)}</span></div>
    </article>`;
  }

  function tradingViewSymbol(stock) {
    const ticker = String(stock.ticker).toUpperCase();
    return `${exchangeOverrides[ticker] ?? "NASDAQ"}:${ticker}`;
  }

  function renderWidgetFallback(frame, stock, sourceUrl) {
    if (frame.querySelector("iframe")) return;
    frame.innerHTML = `<div class="leaderboard-empty">
      <strong>EXTERNAL WIDGET BLOCKED OR SLOW</strong><br>
      External Market Data · May Be Delayed. The chart provider did not load here.
      <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener nofollow">Open ${escapeHtml(stock.ticker)} directly on TradingView</a>.
    </div>`;
  }

  function renderMarketSnapshot(stock) {
    const frame = document.querySelector("[data-market-widget]");
    if (!frame) return;

    const ticker = String(stock.ticker).toUpperCase();
    const symbol = tradingViewSymbol(stock);
    const sourceUrl = `https://www.tradingview.com/symbols/${symbol.replace(":", "-")}/`;

    document.querySelector("[data-market-ticker]").textContent = ticker;
    document.querySelector("[data-market-selected]").textContent = `${stock.name} · ${stock.sector}`;

    const checkLink = document.querySelector("[data-market-check-link]");
    checkLink.href = `monster-check.html?ticker=${encodeURIComponent(ticker)}`;
    checkLink.textContent = `OPEN ${ticker} MONSTER CHECK™`;

    const select = document.querySelector("[data-market-select]");
    if (select.value !== ticker) select.value = ticker;
    document.querySelectorAll("[data-market-symbol]").forEach((button) => {
      const active = button.dataset.marketSymbol === ticker;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    frame.replaceChildren();
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "calc(100% - 32px)";
    widget.style.width = "100%";

    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright";
    const sourceLink = document.createElement("a");
    sourceLink.href = sourceUrl;
    sourceLink.rel = "noopener nofollow";
    sourceLink.target = "_blank";
    sourceLink.textContent = `${stock.name} chart by TradingView`;
    copyright.append(sourceLink);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.async = true;
    script.textContent = JSON.stringify({
      symbols: [[stock.name, `${symbol}|1D`]], chartOnly: false, width: "100%", height: "100%",
      locale: "en", colorTheme: "light", autosize: true, showVolume: true, showMA: false,
      hideDateRanges: false, hideMarketStatus: false, hideSymbolLogo: false, scalePosition: "right",
      scaleMode: "Normal", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10",
      noTimeScale: false, valuesTracking: "1", changeMode: "price-and-percent", chartType: "area",
      lineWidth: 2, lineType: 0, dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
    });

    wrapper.append(widget, copyright, script);
    frame.append(wrapper);
    window.setTimeout(() => renderWidgetFallback(frame, stock, sourceUrl), 12_000);
  }

  function setupMarketExplorer(stocks) {
    const select = document.querySelector("[data-market-select]");
    const buttons = document.querySelector("[data-market-buttons]");
    if (!select || !buttons || stocks.length === 0) return;

    const byTicker = new Map(stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]));
    select.replaceChildren();
    buttons.replaceChildren();

    stocks.forEach((stock) => {
      const ticker = String(stock.ticker).toUpperCase();
      const option = document.createElement("option");
      option.value = ticker;
      option.textContent = `${ticker} · ${stock.name}`;
      select.append(option);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "snapshot-stock-button";
      button.dataset.marketSymbol = ticker;
      button.setAttribute("aria-pressed", "false");
      button.textContent = ticker;
      button.addEventListener("click", () => renderMarketSnapshot(stock));
      buttons.append(button);
    });

    select.addEventListener("change", () => {
      const stock = byTicker.get(String(select.value).toUpperCase());
      if (stock) renderMarketSnapshot(stock);
    });
    renderMarketSnapshot(byTicker.get("AAPL") ?? stocks[0]);
  }

  async function fetchReadiness(baseUrl) {
    const response = await fetch(`${baseUrl}/api/readiness`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.companies)) throw new Error("Invalid readiness response");
    return payload;
  }

  async function setupLiveStatus() {
    const list = document.querySelector("[data-status-list]");
    if (!list) return;
    try {
      const response = await fetch("data/stocks.json");
      if (!response.ok) throw new Error("Stock list unavailable");
      const stocks = await response.json();
      if (!Array.isArray(stocks) || stocks.length === 0) throw new Error("Stock list invalid");
      const ordered = [...stocks].sort((left, right) => left.ticker.localeCompare(right.ticker));
      setupMarketExplorer(ordered);

      let snapshot = null;
      const baseUrl = apiBaseUrl();
      if (baseUrl) {
        try {
          snapshot = await fetchReadiness(baseUrl);
        } catch (_error) {
          snapshot = null;
        }
      }
      const byTicker = new Map((snapshot?.companies ?? []).map((company) => [String(company.ticker).toUpperCase(), company]));
      list.innerHTML = ordered.map((stock, index) => statusRow(stock, index, byTicker.get(stock.ticker))).join("");
    } catch (_error) {
      list.innerHTML = "<p class=\"leaderboard-empty\">The 15-stock checklist could not load. No quote, SEC identity, or rating status was invented.</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", () => void setupLiveStatus());
})();
