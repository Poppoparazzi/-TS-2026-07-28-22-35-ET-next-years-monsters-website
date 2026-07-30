// TS: 2026-07-30 07:17 ET

const EXPLORER_EXCHANGE_OVERRIDES = Object.freeze({
  DECK: "NYSE",
  VRT: "NYSE",
});

function explorerSymbol(stock) {
  const ticker = String(stock.ticker).toUpperCase();
  const exchange = EXPLORER_EXCHANGE_OVERRIDES[ticker] ?? "NASDAQ";
  return `${exchange}:${ticker}`;
}

function tickerFromWidgetSymbol(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return "";
  const parts = normalized.split(":");
  return parts[parts.length - 1].replace(/[^A-Z0-9.-]/g, "");
}

function explorerText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function buildTradingViewWidget(frame, stock) {
  const symbol = explorerSymbol(stock);
  const tradingViewPath = symbol.replace(":", "-");

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
  sourceLink.href = `https://www.tradingview.com/symbols/${tradingViewPath}/`;
  sourceLink.rel = "noopener nofollow";
  sourceLink.target = "_blank";
  sourceLink.textContent = `${stock.name} stock price`;
  copyright.append(sourceLink, document.createTextNode(" by TradingView"));

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
  script.async = true;
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

  if (!leftSelect || !rightSelect || !swapButton || !quickButtons || !leftFrame || !rightFrame) {
    return;
  }

  const byTicker = new Map(
    stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]),
  );

  populateSelect(leftSelect, stocks);
  populateSelect(rightSelect, stocks);

  const params = new URLSearchParams(window.location.search);
  const widgetTicker = tickerFromWidgetSymbol(params.get("tvwidgetsymbol"));
  const requestedLeft = String(params.get("left") || widgetTicker || "AAPL").toUpperCase();
  const requestedRight = String(params.get("right") || "NVDA").toUpperCase();

  leftSelect.value = byTicker.has(requestedLeft) ? requestedLeft : "AAPL";
  rightSelect.value = byTicker.has(requestedRight) ? requestedRight : "NVDA";

  function updateUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set("left", leftSelect.value);
    url.searchParams.set("right", rightSelect.value);
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

    const monsterLink = document.querySelector(`[data-explorer-${prefix}-monster-link]`);
    if (monsterLink) {
      monsterLink.href = `monster-check.html?ticker=${encodeURIComponent(stock.ticker)}`;
      monsterLink.textContent = `OPEN ${stock.ticker} MONSTER CHECK™`;
    }

    const chartLink = document.querySelector(`[data-explorer-${prefix}-chart-link]`);
    if (chartLink) {
      const path = explorerSymbol(stock).replace(":", "-");
      chartLink.href = `https://www.tradingview.com/symbols/${path}/`;
    }

    buildTradingViewWidget(frame, stock);
    updateUrl();
  }

  leftSelect.addEventListener("change", () => renderSide("left"));
  rightSelect.addEventListener("change", () => renderSide("right"));

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
    button.title = `Load ${stock.name} into the left comparison chart`;
    button.addEventListener("click", () => {
      leftSelect.value = String(stock.ticker).toUpperCase();
      renderSide("left");
      leftFrame.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    quickButtons.append(button);
  });

  renderSide("left");
  renderSide("right");
}

async function startMarketExplorer() {
  const status = document.querySelector("[data-explorer-status]");

  try {
    const response = await fetch("data/stocks.json");
    if (!response.ok) throw new Error("Unable to load the pilot stock list.");

    const stocks = await response.json();
    const ordered = [...stocks].sort((left, right) =>
      String(left.ticker).localeCompare(String(right.ticker)),
    );

    setupExplorer(ordered);
    if (status) status.textContent = "15 PILOT STOCKS READY TO COMPARE";
  } catch (_error) {
    if (status) status.textContent = "MARKET EXPLORER COULD NOT LOAD THE STOCK LIST";

    document.querySelectorAll(".explorer-chart-frame").forEach((frame) => {
      frame.replaceChildren();
      const message = document.createElement("p");
      message.className = "explorer-loading";
      message.textContent = "The market chart list did not load. No ticker or price was invented.";
      frame.append(message);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarketExplorer);
} else {
  startMarketExplorer();
}
