// TS: 2026-07-30 07:49 ET

const NYM_PILOT_MARKET_SYMBOLS = Object.freeze([
  Object.freeze({ ticker: "AAPL", name: "Apple", proName: "NASDAQ:AAPL" }),
  Object.freeze({ ticker: "AMD", name: "AMD", proName: "NASDAQ:AMD" }),
  Object.freeze({ ticker: "AMZN", name: "Amazon", proName: "NASDAQ:AMZN" }),
  Object.freeze({ ticker: "APP", name: "AppLovin", proName: "NASDAQ:APP" }),
  Object.freeze({ ticker: "AXON", name: "Axon", proName: "NASDAQ:AXON" }),
  Object.freeze({ ticker: "COST", name: "Costco", proName: "NASDAQ:COST" }),
  Object.freeze({ ticker: "DECK", name: "Deckers", proName: "NYSE:DECK" }),
  Object.freeze({ ticker: "META", name: "Meta", proName: "NASDAQ:META" }),
  Object.freeze({ ticker: "MNST", name: "Monster Beverage", proName: "NASDAQ:MNST" }),
  Object.freeze({ ticker: "MSFT", name: "Microsoft", proName: "NASDAQ:MSFT" }),
  Object.freeze({ ticker: "NFLX", name: "Netflix", proName: "NASDAQ:NFLX" }),
  Object.freeze({ ticker: "NVDA", name: "NVIDIA", proName: "NASDAQ:NVDA" }),
  Object.freeze({ ticker: "TSLA", name: "Tesla", proName: "NASDAQ:TSLA" }),
  Object.freeze({ ticker: "VRT", name: "Vertiv", proName: "NYSE:VRT" }),
  Object.freeze({ ticker: "WING", name: "Wingstop", proName: "NASDAQ:WING" }),
]);

function ensureMarketTickerStyles() {
  if (document.querySelector('link[data-nym-market-tape-style]')) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/market-ticker-strip.css";
  link.dataset.nymMarketTapeStyle = "";
  document.head.append(link);
}

function ensureMarketExplorerNavLink() {
  const navigation = document.querySelector("nav.nav-links");
  if (!navigation) return;

  let link = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes("market-explorer.html"),
  );

  if (!link) {
    link = document.createElement("a");
    link.href = "market-explorer.html";
    navigation.append(link);
  }

  link.textContent = "FULL CHARTS";
  link.title = "Open the full white-background Market Explorer charts";
  link.setAttribute("aria-label", "Open full stock charts in Market Explorer");

  if (window.location.pathname.endsWith("market-explorer.html")) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  let pulseLink = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes("market-pulse.html"),
  );

  if (!pulseLink) {
    pulseLink = document.createElement("a");
    pulseLink.href = "market-pulse.html";
    pulseLink.textContent = "MARKET PULSE";
    navigation.append(pulseLink);
  }

  if (window.location.pathname.endsWith("market-pulse.html")) {
    pulseLink.classList.add("active");
    pulseLink.setAttribute("aria-current", "page");
  }

  let newsLink = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes("news-radar.html"),
  );

  if (!newsLink) {
    newsLink = document.createElement("a");
    newsLink.href = "news-radar.html";
    newsLink.textContent = "NEWS RADAR";
    navigation.append(newsLink);
  }

  if (window.location.pathname.endsWith("news-radar.html")) {
    newsLink.classList.add("active");
    newsLink.setAttribute("aria-current", "page");
  }

  let coverageLink = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes("coverage-universe.html"),
  );

  if (!coverageLink) {
    coverageLink = document.createElement("a");
    coverageLink.href = "coverage-universe.html";
    coverageLink.textContent = "COVERAGE";
    navigation.append(coverageLink);
  }

  if (window.location.pathname.endsWith("coverage-universe.html")) {
    coverageLink.classList.add("active");
    coverageLink.setAttribute("aria-current", "page");
  }
}

function createMarketTickerStrip() {
  ensureMarketExplorerNavLink();
  if (document.querySelector("[data-nym-market-tape]")) return;

  const header = document.querySelector("header.site-header");
  if (!header) return;

  ensureMarketTickerStyles();

  const section = document.createElement("section");
  section.className = "nym-market-tape";
  section.dataset.nymMarketTape = "";
  section.setAttribute("aria-label", "15-stock external market ticker tape and full chart shortcuts");

  const head = document.createElement("div");
  head.className = "nym-market-tape-head";

  const label = document.createElement("span");
  label.className = "nym-market-tape-label";
  label.textContent = "15-STOCK MARKET TAPE · EXTERNAL MARKET DATA";

  const explorerLink = document.createElement("a");
  explorerLink.href = "market-explorer.html";
  explorerLink.textContent = "OPEN FULL CHARTS →";
  explorerLink.title = "Open one large chart or compare two charts";
  explorerLink.setAttribute("aria-label", "Open the full Market Explorer charts");

  head.append(label, explorerLink);

  const widgetShell = document.createElement("div");
  widgetShell.className = "nym-market-tape-widget";

  const tradingViewContainer = document.createElement("div");
  tradingViewContainer.className = "tradingview-widget-container";
  tradingViewContainer.style.height = "100%";
  tradingViewContainer.style.width = "100%";

  const tradingViewWidget = document.createElement("div");
  tradingViewWidget.className = "tradingview-widget-container__widget";

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
  script.async = true;
  script.textContent = JSON.stringify({
    symbols: NYM_PILOT_MARKET_SYMBOLS.map(({ name, proName }) => ({
      description: name,
      proName,
    })),
    showSymbolLogo: true,
    isTransparent: true,
    displayMode: "adaptive",
    colorTheme: "dark",
    locale: "en",
  });

  tradingViewContainer.append(tradingViewWidget, script);
  widgetShell.append(tradingViewContainer);

  const quickLinks = document.createElement("nav");
  quickLinks.className = "nym-market-tape-links";
  quickLinks.setAttribute("aria-label", "Open a pilot stock in its full single chart");

  NYM_PILOT_MARKET_SYMBOLS.forEach(({ ticker, name }) => {
    const link = document.createElement("a");
    link.href = `market-explorer.html?left=${encodeURIComponent(ticker)}&mode=single`;
    link.textContent = ticker;
    link.title = `Open ${name} in the full single-chart view`;
    link.setAttribute("aria-label", `Open ${name} full chart`);
    quickLinks.append(link);
  });

  const note = document.createElement("p");
  note.className = "nym-market-tape-note";
  note.textContent =
    "CLICK ANY TICKER BUTTON ABOVE to open that company in the full single-chart view. FULL CHARTS are also always available from the navigation and the OPEN FULL CHARTS link. Prices and percentage moves are supplied by TradingView and may be delayed. These market snapshots do not make the demonstration Monster Ratings live.";

  section.append(head, widgetShell, quickLinks, note);
  header.insertAdjacentElement("afterend", section);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createMarketTickerStrip);
} else {
  createMarketTickerStrip();
}
