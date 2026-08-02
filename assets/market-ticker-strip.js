// TS: 2026-08-02 10:01 ET

const NYM_MARKET_FALLBACK = Object.freeze([
  { ticker: "AAPL", name: "Apple", proName: "NASDAQ:AAPL" },
  { ticker: "AMD", name: "Advanced Micro Devices", proName: "NASDAQ:AMD" },
  { ticker: "AMZN", name: "Amazon", proName: "NASDAQ:AMZN" },
  { ticker: "APP", name: "AppLovin", proName: "NASDAQ:APP" },
  { ticker: "AXON", name: "Axon Enterprise", proName: "NASDAQ:AXON" },
  { ticker: "COST", name: "Costco", proName: "NASDAQ:COST" },
  { ticker: "DECK", name: "Deckers Outdoor", proName: "NYSE:DECK" },
  { ticker: "META", name: "Meta Platforms", proName: "NASDAQ:META" },
  { ticker: "MNST", name: "Monster Beverage", proName: "NASDAQ:MNST" },
  { ticker: "MSFT", name: "Microsoft", proName: "NASDAQ:MSFT" },
  { ticker: "NFLX", name: "Netflix", proName: "NASDAQ:NFLX" },
  { ticker: "NVDA", name: "NVIDIA", proName: "NASDAQ:NVDA" },
  { ticker: "TSLA", name: "Tesla", proName: "NASDAQ:TSLA" },
  { ticker: "VRT", name: "Vertiv", proName: "NYSE:VRT" },
  { ticker: "WING", name: "Wingstop", proName: "NASDAQ:WING" },
]);

async function loadNymMarketUniverse() {
  try {
    const response = await fetch("data/market-universe.json");
    if (!response.ok) throw new Error("Market universe unavailable");
    const stocks = await response.json();
    if (!Array.isArray(stocks) || !stocks.length) throw new Error("Market universe empty");
    return stocks;
  } catch (_error) {
    return NYM_MARKET_FALLBACK;
  }
}

function ensureMarketTickerStyles() {
  if (document.querySelector('link[data-nym-market-tape-style]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "assets/market-ticker-strip.css";
  link.dataset.nymMarketTapeStyle = "";
  document.head.append(link);
}

function currentNymPageName() {
  const pathname = window.location.pathname || "";
  const last = pathname.split("/").filter(Boolean).pop() || "index.html";
  return last === "" ? "index.html" : last;
}

function ensureCoreNavigationLinks(navigation) {
  const currentPage = currentNymPageName();

  let homeLink = [...navigation.querySelectorAll("a")].find((item) => {
    const href = item.getAttribute("href") || "";
    return href === "index.html" || href.endsWith("/index.html") || href === "./";
  });
  if (!homeLink) {
    homeLink = document.createElement("a");
    homeLink.href = "index.html";
    navigation.prepend(homeLink);
  }
  homeLink.textContent = "HOME";
  homeLink.title = "Return to the Next Year’s Monsters homepage";
  homeLink.setAttribute("aria-label", "Return to the homepage");
  if (currentPage === "index.html") {
    homeLink.classList.add("active");
    homeLink.setAttribute("aria-current", "page");
  }

  let startLink = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes("start-here.html"),
  );
  if (!startLink) {
    startLink = document.createElement("a");
    startLink.href = "start-here.html";
    homeLink.insertAdjacentElement("afterend", startLink);
  }
  startLink.textContent = "START HERE";
  startLink.title = "Open the plain-English guide to using this website";
  startLink.setAttribute("aria-label", "Open the Start Here website guide");
  if (currentPage === "start-here.html") {
    startLink.classList.add("active");
    startLink.setAttribute("aria-current", "page");
  }
}

function ensureMarketExplorerNavLink() {
  const navigation = document.querySelector("nav.nav-links");
  if (!navigation) return;

  ensureCoreNavigationLinks(navigation);

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
  if (currentNymPageName() === "market-explorer.html") {
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
  if (currentNymPageName() === "market-pulse.html") {
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
  if (currentNymPageName() === "news-radar.html") {
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
  if (currentNymPageName() === "coverage-universe.html") {
    coverageLink.classList.add("active");
    coverageLink.setAttribute("aria-current", "page");
  }
}

async function createMarketTickerStrip() {
  ensureMarketExplorerNavLink();
  if (document.querySelector("[data-nym-market-tape]")) return;

  const header = document.querySelector("header.site-header");
  if (!header) return;
  ensureMarketTickerStyles();

  const stocks = await loadNymMarketUniverse();
  const count = stocks.length;

  const section = document.createElement("section");
  section.className = "nym-market-tape";
  section.dataset.nymMarketTape = "";
  section.setAttribute("aria-label", `${count}-stock external market ticker tape and full chart shortcuts`);

  const head = document.createElement("div");
  head.className = "nym-market-tape-head";

  const label = document.createElement("span");
  label.className = "nym-market-tape-label";
  label.textContent = `${count}-STOCK MARKET TAPE · EXTERNAL MARKET DATA`;

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
    symbols: stocks.map((stock) => ({
      description: stock.name,
      proName: stock.proName || `${stock.exchange || "NASDAQ"}:${stock.ticker}`,
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
  quickLinks.setAttribute("aria-label", "Open a market stock in its full single chart");

  stocks.forEach(({ ticker, name }) => {
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
    `CLICK ANY TICKER BUTTON ABOVE to open that company in the full single-chart view. The ${count}-stock tape uses external market data that may be delayed. Fifteen companies currently have demonstration Monster Checks; the additional ten are chart-and-news coverage only.`;

  section.append(head, widgetShell, quickLinks, note);
  header.insertAdjacentElement("afterend", section);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createMarketTickerStrip);
} else {
  createMarketTickerStrip();
}
