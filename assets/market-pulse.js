// TS: 2026-08-04 16:34 ET

const WIDGET_TIMEOUT_MS = 8000;

function pulseText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function siteUrl(path) {
  return new URL(path, window.location.href).href;
}

function renderProviderFallback(frame, message, sourceUrl) {
  if (!frame) return;
  frame.replaceChildren();

  const wrapper = document.createElement("div");
  wrapper.className = "pulse-loading";

  const text = document.createElement("p");
  text.textContent = message;
  wrapper.append(text);

  const source = document.createElement("a");
  source.href = sourceUrl;
  source.target = "_blank";
  source.rel = "noopener noreferrer";
  source.textContent = "OPEN TRADINGVIEW DIRECTLY →";
  wrapper.append(source);

  frame.append(wrapper);
}

function mountTradingViewWidget(frame, source, configuration, fallbackUrl) {
  if (!frame) return Promise.resolve(false);
  frame.replaceChildren();

  return new Promise((resolve) => {
    let settled = false;

    const fail = () => {
      if (settled) return;
      settled = true;
      renderProviderFallback(
        frame,
        "Provider Not Connected. The external widget may be blocked or unavailable. No market value was invented.",
        fallbackUrl,
      );
      resolve(false);
    };

    const container = document.createElement("div");
    container.className = "tradingview-widget-container";
    container.style.width = "100%";
    container.style.height = "100%";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.width = "100%";
    widget.style.height = "100%";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = source;
    script.async = true;
    script.textContent = JSON.stringify(configuration);
    script.addEventListener("error", fail, { once: true });
    script.addEventListener(
      "load",
      () => {
        if (settled) return;
        settled = true;
        resolve(true);
      },
      { once: true },
    );

    container.append(widget, script);
    frame.append(container);
    window.setTimeout(fail, WIDGET_TIMEOUT_MS);
  });
}

function mountMarketOverview(stocks) {
  const marketSymbols = stocks.map((stock) => ({
    s: stock.proName || `${stock.exchange || "NASDAQ"}:${stock.ticker}`,
    d: stock.name,
  }));

  return mountTradingViewWidget(
    document.querySelector("[data-pulse-overview]"),
    "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
    {
      colorTheme: "dark",
      dateRange: "12M",
      showChart: true,
      locale: "en",
      width: "100%",
      height: "100%",
      largeChartUrl: siteUrl("market-explorer.html"),
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      plotLineColorGrowing: "rgba(184, 243, 74, 1)",
      plotLineColorFalling: "rgba(183, 45, 39, 1)",
      gridLineColor: "rgba(240, 243, 250, 0.08)",
      scaleFontColor: "rgba(209, 212, 220, 1)",
      belowLineFillColorGrowing: "rgba(184, 243, 74, 0.14)",
      belowLineFillColorFalling: "rgba(183, 45, 39, 0.14)",
      belowLineFillColorGrowingBottom: "rgba(184, 243, 74, 0)",
      belowLineFillColorFallingBottom: "rgba(183, 45, 39, 0)",
      symbolActiveColor: "rgba(217, 170, 49, 0.18)",
      tabs: [
        {
          title: "Market 25",
          symbols: marketSymbols,
          originalTitle: "Market 25",
        },
        {
          title: "Major Indexes",
          symbols: [
            { s: "FOREXCOM:SPXUSD", d: "S&P 500" },
            { s: "NASDAQ:NDX", d: "Nasdaq 100" },
            { s: "DJ:DJI", d: "Dow Jones" },
            { s: "RUSSELL:RUT", d: "Russell 2000" },
            { s: "CBOE:VIX", d: "Volatility Index" },
          ],
          originalTitle: "Major Indexes",
        },
        {
          title: "Sectors",
          symbols: [
            { s: "AMEX:XLK", d: "Technology" },
            { s: "AMEX:XLY", d: "Consumer Discretionary" },
            { s: "AMEX:XLC", d: "Communication Services" },
            { s: "AMEX:XLF", d: "Financials" },
            { s: "AMEX:XLI", d: "Industrials" },
            { s: "AMEX:XLE", d: "Energy" },
            { s: "AMEX:XLV", d: "Health Care" },
            { s: "AMEX:XLP", d: "Consumer Staples" },
            { s: "AMEX:XLU", d: "Utilities" },
            { s: "AMEX:XLRE", d: "Real Estate" },
          ],
          originalTitle: "Sectors",
        },
        {
          title: "Macro",
          symbols: [
            { s: "TVC:DXY", d: "U.S. Dollar Index" },
            { s: "TVC:US10Y", d: "U.S. 10-Year Yield" },
            { s: "COMEX:GC1!", d: "Gold" },
            { s: "NYMEX:CL1!", d: "Crude Oil" },
            { s: "COINBASE:BTCUSD", d: "Bitcoin" },
          ],
          originalTitle: "Macro",
        },
      ],
    },
    "https://www.tradingview.com/markets/stocks-usa/market-movers-large-cap/",
  );
}

function mountMarketHeatmap() {
  return mountTradingViewWidget(
    document.querySelector("[data-pulse-heatmap]"),
    "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js",
    {
      exchanges: [],
      dataSource: "SPX500",
      grouping: "sector",
      blockSize: "market_cap_basic",
      blockColor: "change",
      locale: "en",
      symbolUrl: siteUrl("market-explorer.html"),
      colorTheme: "dark",
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%",
    },
    "https://www.tradingview.com/heatmap/stock/",
  );
}

async function startMarketPulse() {
  try {
    const response = await fetch("data/market-universe.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load the Market 25 list.");

    const stocks = await response.json();
    if (!Array.isArray(stocks) || stocks.length === 0) {
      throw new Error("The Market 25 list is empty.");
    }

    const results = await Promise.all([mountMarketOverview(stocks), mountMarketHeatmap()]);
    pulseText(
      "[data-pulse-status]",
      results.every(Boolean) ? "EXTERNAL WIDGETS REQUESTED" : "PROVIDER NOT CONNECTED",
    );
  } catch (_error) {
    pulseText("[data-pulse-status]", "PROVIDER NOT CONNECTED");
    renderProviderFallback(
      document.querySelector("[data-pulse-overview]"),
      "Provider Not Connected. The Market 25 list or external overview could not be loaded. No market value was invented.",
      "https://www.tradingview.com/markets/stocks-usa/market-movers-large-cap/",
    );
    renderProviderFallback(
      document.querySelector("[data-pulse-heatmap]"),
      "Provider Not Connected. The external heatmap could not be loaded. No market value was invented.",
      "https://www.tradingview.com/heatmap/stock/",
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarketPulse);
} else {
  startMarketPulse();
}
