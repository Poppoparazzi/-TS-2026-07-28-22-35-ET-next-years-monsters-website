// TS: 2026-07-30 07:17 ET

const MARKET_EXPLORER_URL =
  "https://poppoparazzi.github.io/-TS-2026-07-28-22-35-ET-next-years-monsters-website/market-explorer.html";

const PULSE_MONSTER_SYMBOLS = Object.freeze([
  { s: "NASDAQ:AAPL", d: "Apple" },
  { s: "NASDAQ:AMD", d: "AMD" },
  { s: "NASDAQ:AMZN", d: "Amazon" },
  { s: "NASDAQ:APP", d: "AppLovin" },
  { s: "NASDAQ:AXON", d: "Axon" },
  { s: "NASDAQ:COST", d: "Costco" },
  { s: "NYSE:DECK", d: "Deckers" },
  { s: "NASDAQ:META", d: "Meta" },
  { s: "NASDAQ:MNST", d: "Monster Beverage" },
  { s: "NASDAQ:MSFT", d: "Microsoft" },
  { s: "NASDAQ:NFLX", d: "Netflix" },
  { s: "NASDAQ:NVDA", d: "NVIDIA" },
  { s: "NASDAQ:TSLA", d: "Tesla" },
  { s: "NYSE:VRT", d: "Vertiv" },
  { s: "NASDAQ:WING", d: "Wingstop" },
]);

function pulseText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function mountTradingViewWidget(frame, source, configuration) {
  if (!frame) return;

  frame.replaceChildren();

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

  container.append(widget, script);
  frame.append(container);
}

function mountMarketOverview() {
  mountTradingViewWidget(
    document.querySelector("[data-pulse-overview]"),
    "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
    {
      colorTheme: "dark",
      dateRange: "12M",
      showChart: true,
      locale: "en",
      width: "100%",
      height: "100%",
      largeChartUrl: MARKET_EXPLORER_URL,
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
          title: "Monster 15",
          symbols: PULSE_MONSTER_SYMBOLS,
          originalTitle: "Monster 15",
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
  );
}

function mountMarketHeatmap() {
  mountTradingViewWidget(
    document.querySelector("[data-pulse-heatmap]"),
    "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js",
    {
      exchanges: [],
      dataSource: "SPX500",
      grouping: "sector",
      blockSize: "market_cap_basic",
      blockColor: "change",
      locale: "en",
      symbolUrl: MARKET_EXPLORER_URL,
      colorTheme: "dark",
      hasTopBar: true,
      isDataSetEnabled: true,
      isZoomEnabled: true,
      hasSymbolTooltip: true,
      isMonoSize: false,
      width: "100%",
      height: "100%",
    },
  );
}

function startMarketPulse() {
  try {
    mountMarketOverview();
    mountMarketHeatmap();
    pulseText("[data-pulse-status]", "DASHBOARD REQUESTED");
  } catch (_error) {
    pulseText("[data-pulse-status]", "WIDGET LOAD FAILED");
    document.querySelectorAll("[data-pulse-overview], [data-pulse-heatmap]").forEach((frame) => {
      frame.replaceChildren();
      const message = document.createElement("p");
      message.className = "pulse-loading";
      message.textContent = "The external market widget could not be requested. No market value was invented.";
      frame.append(message);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startMarketPulse);
} else {
  startMarketPulse();
}
