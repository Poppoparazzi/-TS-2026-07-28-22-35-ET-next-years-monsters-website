// TS: 2026-08-04 15:36 ET

const NEWS_RADAR_WIDGET_TIMEOUT_MS = 8000;

function newsRadarSymbol(stock) {
  if (stock.proName) return stock.proName;
  const ticker = String(stock.ticker).toUpperCase();
  const exchange = String(stock.exchange || "NASDAQ").toUpperCase();
  return `${exchange}:${ticker}`;
}

function newsRadarText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function tradingViewUrl(stock, section = "") {
  const symbol = newsRadarSymbol(stock).replace(":", "-");
  return `https://www.tradingview.com/symbols/${symbol}/${section}`;
}

function createProviderFallback(frame, stock, kind) {
  frame.replaceChildren();
  const wrapper = document.createElement("div");
  wrapper.className = "news-radar-loading";

  const message = document.createElement("p");
  message.textContent = `Provider Not Connected: the external ${kind} could not be displayed here. No story, timestamp, price, or rating impact was invented.`;

  const link = document.createElement("a");
  link.href = kind === "news" ? tradingViewUrl(stock, "news/") : tradingViewUrl(stock);
  link.target = "_blank";
  link.rel = "noopener nofollow";
  link.textContent = `Open ${stock.ticker} ${kind} directly at TradingView`;

  wrapper.append(message, link);
  frame.append(wrapper);
}

function createTradingViewShell(frame) {
  frame.replaceChildren();
  const container = document.createElement("div");
  container.className = "tradingview-widget-container";
  container.style.width = "100%";
  container.style.height = "100%";

  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  widget.style.width = "100%";
  widget.style.height = "100%";

  container.append(widget);
  frame.append(container);
  return container;
}

function watchWidget(frame, stock, kind) {
  window.setTimeout(() => {
    if (!frame.querySelector("iframe")) createProviderFallback(frame, stock, kind);
  }, NEWS_RADAR_WIDGET_TIMEOUT_MS);
}

function mountNewsWidget(frame, stock) {
  const symbol = newsRadarSymbol(stock);
  const container = createTradingViewShell(frame);
  const copyright = document.createElement("div");
  copyright.className = "tradingview-widget-copyright";

  const link = document.createElement("a");
  link.href = tradingViewUrl(stock, "news/");
  link.rel = "noopener nofollow";
  link.target = "_blank";
  link.textContent = `${stock.name} news`;
  copyright.append(link, document.createTextNode(" by TradingView"));

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
  script.async = true;
  script.onerror = () => createProviderFallback(frame, stock, "news");
  script.textContent = JSON.stringify({
    displayMode: "regular",
    feedMode: "symbol",
    symbol,
    colorTheme: "dark",
    isTransparent: true,
    locale: "en",
    width: "100%",
    height: "100%",
  });

  container.append(copyright, script);
  watchWidget(frame, stock, "news");
}

function mountReactionChart(frame, stock) {
  const symbol = newsRadarSymbol(stock);
  const container = createTradingViewShell(frame);
  const copyright = document.createElement("div");
  copyright.className = "tradingview-widget-copyright";

  const link = document.createElement("a");
  link.href = tradingViewUrl(stock);
  link.rel = "noopener nofollow";
  link.target = "_blank";
  link.textContent = `${stock.name} stock price`;
  copyright.append(link, document.createTextNode(" by TradingView"));

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
  script.async = true;
  script.onerror = () => createProviderFallback(frame, stock, "chart");
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

  container.append(copyright, script);
  watchWidget(frame, stock, "chart");
}

function populateNewsRadarSelect(select, stocks) {
  select.replaceChildren();
  stocks.forEach((stock) => {
    const option = document.createElement("option");
    option.value = String(stock.ticker).toUpperCase();
    option.textContent = `${stock.ticker} · ${stock.name}`;
    select.append(option);
  });
}

function setupNewsRadar(stocks) {
  const select = document.querySelector("[data-news-radar-select]");
  const buttons = document.querySelector("[data-news-radar-buttons]");
  const newsFrame = document.querySelector("[data-news-radar-feed]");
  const chartFrame = document.querySelector("[data-news-radar-chart]");
  if (!select || !buttons || !newsFrame || !chartFrame || stocks.length === 0) return;

  const byTicker = new Map(stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]));
  populateNewsRadarSelect(select, stocks);

  const params = new URLSearchParams(window.location.search);
  const requestedTicker = String(params.get("ticker") ?? "AAPL").trim().toUpperCase();
  const defaultTicker = byTicker.has("AAPL") ? "AAPL" : String(stocks[0].ticker).toUpperCase();
  select.value = byTicker.has(requestedTicker) ? requestedTicker : defaultTicker;

  function render(stock) {
    const ticker = String(stock.ticker).toUpperCase();

    select.value = ticker;
    newsRadarText("[data-news-radar-ticker]", `$${ticker}`);
    newsRadarText("[data-news-radar-company]", `${stock.name} · ${stock.sector}`);
    newsRadarText("[data-news-radar-feed-title]", `${ticker} PROVIDER STORIES`);
    newsRadarText("[data-news-radar-chart-title]", `${ticker} PROVIDER CHART`);
    newsRadarText("[data-news-radar-status]", "EXTERNAL PROVIDER REQUESTED");

    const researchLink = document.querySelector("[data-news-radar-monster-link]");
    if (researchLink) {
      researchLink.href = `monster-check.html?ticker=${encodeURIComponent(ticker)}`;
      researchLink.textContent = stock.monsterCheck
        ? `OPEN ${ticker} DEMONSTRATION CHECK™`
        : `CHECK ${ticker} SEC EVIDENCE`;
    }

    const compareTicker = ticker === "NVDA" ? "AAPL" : "NVDA";
    const compareLink = document.querySelector("[data-news-radar-compare-link]");
    if (compareLink) {
      compareLink.href = `market-explorer.html?left=${encodeURIComponent(ticker)}&right=${compareTicker}&mode=compare`;
      compareLink.textContent = `COMPARE ${ticker} WITH ${compareTicker}`;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("ticker", ticker);
    window.history.replaceState({}, "", url);

    document.querySelectorAll("[data-news-radar-symbol]").forEach((button) => {
      const active = button.dataset.newsRadarSymbol === ticker;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    mountNewsWidget(newsFrame, stock);
    mountReactionChart(chartFrame, stock);
  }

  buttons.replaceChildren();
  stocks.forEach((stock) => {
    const ticker = String(stock.ticker).toUpperCase();
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.newsRadarSymbol = ticker;
    button.setAttribute("aria-pressed", "false");
    button.textContent = ticker;
    button.title = `Load ${stock.name} external news and chart`;
    button.addEventListener("click", () => render(stock));
    buttons.append(button);
  });

  select.addEventListener("change", () => {
    const stock = byTicker.get(String(select.value).toUpperCase());
    if (stock) render(stock);
  });

  render(byTicker.get(select.value) ?? stocks[0]);
}

async function startNewsRadar() {
  try {
    const response = await fetch("data/market-universe.json");
    if (!response.ok) throw new Error("Unable to load the external market universe.");
    const stocks = await response.json();
    if (!Array.isArray(stocks) || stocks.length === 0) throw new Error("External market universe is empty.");
    const ordered = [...stocks].sort((left, right) => String(left.ticker).localeCompare(String(right.ticker)));
    setupNewsRadar(ordered);
  } catch (_error) {
    newsRadarText("[data-news-radar-status]", "PROVIDER NOT CONNECTED");
    document.querySelectorAll("[data-news-radar-feed], [data-news-radar-chart]").forEach((frame) => {
      frame.replaceChildren();
      const message = document.createElement("p");
      message.className = "news-radar-loading";
      message.textContent = "Provider Not Connected: the external Market 25 list could not be loaded. No headline, timestamp, price, or rating impact was invented.";
      frame.append(message);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startNewsRadar);
} else {
  startNewsRadar();
}
