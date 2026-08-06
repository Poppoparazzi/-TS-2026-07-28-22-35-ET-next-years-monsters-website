// TS: 2026-08-04 17:48 ET

function explorerApiBaseUrl() {
  const raw = window.NYM_CONFIG?.apiBaseUrl;
  return typeof raw === "string" ? raw.trim().replace(/\/$/, "") : "";
}

function normalizeExplorerTicker(value) {
  const ticker = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9.-]{1,15}$/.test(ticker) ? ticker : "";
}

function tradingViewExchange(value) {
  const exchange = String(value ?? "").trim().toUpperCase();
  if (exchange === "NASDAQ" || exchange === "NYSE" || exchange === "OTC") return exchange;
  if (exchange === "NYSE AMERICAN" || exchange === "AMEX") return "AMEX";
  return "NASDAQ";
}

async function loadOfficialExplorerStock(ticker) {
  const apiBaseUrl = explorerApiBaseUrl();
  if (!apiBaseUrl) throw new Error("Provider Not Connected");

  const response = await fetch(`${apiBaseUrl}/api/sec/company/${encodeURIComponent(ticker)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(65_000),
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Official SEC Evidence unavailable");

  const company = await response.json();
  return {
    ticker: company.ticker,
    name: company.companyName,
    sector: "Official SEC Evidence",
    exchange: tradingViewExchange(company.exchange),
    monsterCheck: false,
    officialSec: true,
  };
}

function explorerSymbol(stock) {
  if (stock.proName) return stock.proName;
  return `${String(stock.exchange || "NASDAQ").toUpperCase()}:${String(stock.ticker).toUpperCase()}`;
}

function tickerFromWidgetSymbol(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "";
  return normalized.split(":").pop().replace(/[^A-Z0-9.-]/g, "");
}

function explorerText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function tradingViewUrl(stock) {
  return `https://www.tradingview.com/symbols/${explorerSymbol(stock).replace(":", "-")}/`;
}

function showWidgetFallback(frame, stock) {
  if (!frame || frame.dataset.widgetReady === "true") return;
  frame.replaceChildren();
  const message = document.createElement("div");
  message.className = "explorer-loading";

  const strong = document.createElement("strong");
  strong.textContent = "PROVIDER NOT CONNECTED";

  const text = document.createElement("p");
  text.textContent = "The external chart was blocked or did not load. No price or market value was invented.";

  const link = document.createElement("a");
  link.href = tradingViewUrl(stock);
  link.rel = "noopener nofollow";
  link.target = "_blank";
  link.textContent = `OPEN ${stock.ticker} ON TRADINGVIEW ↗`;

  message.append(strong, text, link);
  frame.append(message);
}

function buildTradingViewWidget(frame, stock) {
  const symbol = explorerSymbol(stock);
  frame.dataset.widgetReady = "false";
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
  sourceLink.href = tradingViewUrl(stock);
  sourceLink.rel = "noopener nofollow";
  sourceLink.target = "_blank";
  sourceLink.textContent = `${stock.name} chart by TradingView`;
  copyright.append(sourceLink);

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
  script.async = true;
  script.onerror = () => showWidgetFallback(frame, stock);
  script.onload = () => {
    window.setTimeout(() => {
      const rendered = frame.querySelector("iframe");
      if (rendered) frame.dataset.widgetReady = "true";
      else showWidgetFallback(frame, stock);
    }, 8_000);
  };
  script.textContent = JSON.stringify({
    symbols: [[stock.name, `${symbol}|1D`]],
    chartOnly: false,
    width: "100%",
    height: "100%",
    locale: "en",
    colorTheme: "light",
    autosize: true,
    showVolume: true,
    showMA: false,
    hideDateRanges: false,
    hideMarketStatus: false,
    hideSymbolLogo: false,
    scalePosition: "right",
    scaleMode: "Normal",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: "10",
    noTimeScale: false,
    valuesTracking: "1",
    changeMode: "price-and-percent",
    chartType: "area",
    lineWidth: 2,
    lineType: 0,
    dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
  });

  wrapper.append(widget, copyright, script);
  frame.append(wrapper);
  window.setTimeout(() => showWidgetFallback(frame, stock), 10_000);
}

function populateSelect(select, stocks) {
  select.replaceChildren();
  stocks.forEach((stock) => {
    const option = document.createElement("option");
    option.value = String(stock.ticker).toUpperCase();
    option.textContent = `${stock.ticker} · ${stock.name}`;
    select.append(option);
  });
}

function setupExplorer(stocks) {
  const leftSelect = document.querySelector("[data-explorer-left-select]");
  const rightSelect = document.querySelector("[data-explorer-right-select]");
  const swapButton = document.querySelector("[data-explorer-swap]");
  const quickButtons = document.querySelector("[data-explorer-buttons]");
  const leftFrame = document.querySelector("[data-explorer-left-frame]");
  const rightFrame = document.querySelector("[data-explorer-right-frame]");
  const modeButtons = [...document.querySelectorAll("[data-explorer-mode]")];
  const chartCount = document.querySelector("[data-explorer-chart-count]");
  const status = document.querySelector("[data-explorer-status]");
  const tickerForm = document.querySelector("[data-explorer-ticker-form]");
  const tickerInput = document.querySelector("[data-explorer-ticker-input]");
  const tickerMessage = document.querySelector("[data-explorer-ticker-message]");
  if (!leftSelect || !rightSelect || !swapButton || !quickButtons || !leftFrame || !rightFrame) return;

  const byTicker = new Map(stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]));
  populateSelect(leftSelect, stocks);
  populateSelect(rightSelect, stocks);

  const params = new URLSearchParams(window.location.search);
  const requestedLeft = normalizeExplorerTicker(params.get("left") || tickerFromWidgetSymbol(params.get("tvwidgetsymbol"))) || "AAPL";
  const requestedRight = normalizeExplorerTicker(params.get("right")) || "NVDA";
  let currentMode = params.get("mode") === "compare" ? "compare" : "single";
  leftSelect.value = byTicker.has(requestedLeft) ? requestedLeft : "AAPL";
  rightSelect.value = byTicker.has(requestedRight) ? requestedRight : "NVDA";

  function updateUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("left", leftSelect.value);
    url.searchParams.set("right", rightSelect.value);
    url.searchParams.set("mode", currentMode);
    url.searchParams.delete("tvwidgetsymbol");
    window.history.replaceState({}, "", url);
  }

  function renderSide(side) {
    const left = side === "left";
    const select = left ? leftSelect : rightSelect;
    const frame = left ? leftFrame : rightFrame;
    const stock = byTicker.get(String(select.value).toUpperCase());
    if (!stock) return;
    const prefix = left ? "left" : "right";
    explorerText(`[data-explorer-${prefix}-ticker]`, stock.ticker);
    explorerText(`[data-explorer-${prefix}-company]`, `${stock.name} · ${stock.sector}`);

    const researchLink = document.querySelector(`[data-explorer-${prefix}-monster-link]`);
    if (researchLink) {
      researchLink.href = `monster-check.html?ticker=${encodeURIComponent(stock.ticker)}`;
      researchLink.textContent = stock.monsterCheck
        ? `OPEN ${stock.ticker} MONSTER CHECK™`
        : `OPEN ${stock.ticker} SEC CHECK`;
    }

    const chartLink = document.querySelector(`[data-explorer-${prefix}-chart-link]`);
    if (chartLink) chartLink.href = tradingViewUrl(stock);
    buildTradingViewWidget(frame, stock);
    updateUrl();
  }

  function setMode(mode, renderComparison = true) {
    currentMode = mode === "compare" ? "compare" : "single";
    const singleMode = currentMode === "single";
    document.body.classList.toggle("is-single-mode", singleMode);
    modeButtons.forEach((button) => {
      const active = button.dataset.explorerMode === currentMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (chartCount) chartCount.textContent = singleMode ? "1" : "2";
    if (status) status.textContent = singleMode ? "SINGLE CHART READY" : "COMPARE TWO READY";
    if (!singleMode && renderComparison) renderSide("right");
    updateUrl();
  }

  leftSelect.addEventListener("change", () => renderSide("left"));
  rightSelect.addEventListener("change", () => renderSide("right"));
  modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.explorerMode)));
  swapButton.addEventListener("click", () => {
    const leftValue = leftSelect.value;
    leftSelect.value = rightSelect.value;
    rightSelect.value = leftValue;
    renderSide("left");
    renderSide("right");
  });

  quickButtons.replaceChildren();
  stocks.forEach((stock) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = stock.ticker;
    button.title = `Load ${stock.name} into the primary chart`;
    button.addEventListener("click", () => {
      leftSelect.value = String(stock.ticker).toUpperCase();
      renderSide("left");
      leftFrame.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    quickButtons.append(button);
  });

  if (tickerForm && tickerInput) {
    tickerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const ticker = normalizeExplorerTicker(tickerInput.value);
      if (!ticker) {
        if (tickerMessage) tickerMessage.textContent = "Enter an exact ticker using letters, numbers, a period, or a hyphen.";
        return;
      }

      tickerInput.disabled = true;
      if (tickerMessage) tickerMessage.textContent = `Checking $${ticker} for Official SEC Evidence…`;
      try {
        let stock = byTicker.get(ticker);
        if (!stock) {
          stock = await loadOfficialExplorerStock(ticker);
          if (!stock) {
            if (tickerMessage) tickerMessage.textContent = `Unresolved SEC Identity: no current SEC-listed company match was found for $${ticker}.`;
            return;
          }
          byTicker.set(ticker, stock);
          [leftSelect, rightSelect].forEach((select) => {
            const option = document.createElement("option");
            option.value = ticker;
            option.textContent = `${ticker} · ${stock.name}`;
            select.append(option);
          });
        }
        leftSelect.value = ticker;
        renderSide("left");
        if (tickerMessage) tickerMessage.textContent = `$${ticker}: Official SEC Evidence verified. External Market Data · May Be Delayed. Not Yet Rated unless marked as a Demonstration Rating.`;
        leftFrame.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (_error) {
        if (tickerMessage) tickerMessage.textContent = "Provider Not Connected: the official company lookup is temporarily unavailable.";
      } finally {
        tickerInput.disabled = false;
      }
    });
  }

  setMode(currentMode, false);
  renderSide("left");
  if (currentMode === "compare") renderSide("right");
}

async function startMarketExplorer() {
  const status = document.querySelector("[data-explorer-status]");
  try {
    const response = await fetch(window.NYM_STATIC_URL?.("data/market-universe.json") || "data/market-universe.json");
    if (!response.ok) throw new Error("Unable to load Market 25");
    const stocks = await response.json();
    if (!Array.isArray(stocks) || !stocks.length) throw new Error("Empty Market 25");

    const params = new URLSearchParams(window.location.search);
    const requested = [params.get("left"), params.get("right"), tickerFromWidgetSymbol(params.get("tvwidgetsymbol"))]
      .map(normalizeExplorerTicker)
      .filter(Boolean);
    const known = new Set(stocks.map((stock) => String(stock.ticker).toUpperCase()));

    for (const ticker of requested) {
      if (known.has(ticker)) continue;
      try {
        const officialStock = await loadOfficialExplorerStock(ticker);
        if (officialStock) {
          stocks.push(officialStock);
          known.add(ticker);
        }
      } catch (_error) {
        // Market 25 remains usable when the SEC provider is waking or unavailable.
      }
    }

    setupExplorer([...stocks].sort((left, right) => String(left.ticker).localeCompare(String(right.ticker))));
  } catch (_error) {
    if (status) status.textContent = "PROVIDER NOT CONNECTED";
    document.querySelectorAll(".explorer-chart-frame").forEach((frame) => {
      frame.replaceChildren();
      const message = document.createElement("p");
      message.className = "explorer-loading";
      message.textContent = "Provider Not Connected: the Market 25 chart list did not load. No ticker or price was invented.";
      frame.append(message);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarketExplorer);
} else {
  startMarketExplorer();
}
