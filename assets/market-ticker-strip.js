// TS: 2026-08-16 07:32 ET
// LOCK: User-approved homepage ticker uses compact mode so each stock shows name, price, and daily change. Do not switch this back to regular/one-line mode without explicit approval.

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
  if (!document.querySelector('link[data-nym-market-tape-style]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "assets/market-ticker-strip.css?v=20260816-0732";
    link.dataset.nymMarketTapeStyle = "";
    document.head.append(link);
  }

  if (document.getElementById("nym-start-here-nav-style")) return;
  const style = document.createElement("style");
  style.id = "nym-start-here-nav-style";
  style.textContent = `
    .nav-links a.nym-home-link,
    .home-nav-links a.nym-home-link {
      font-weight: 950 !important;
      white-space: nowrap;
    }
    .nav-links a.nym-start-here-primary,
    .home-nav-links a.nym-start-here-primary {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 46px !important;
      padding: 0 20px !important;
      border: 2px solid #080c0b !important;
      border-radius: 0 !important;
      background: var(--editorial-lime, #a8df34) !important;
      color: #080c0b !important;
      box-shadow: 5px 5px 0 rgba(8,12,11,.24) !important;
      font-size: 13px !important;
      font-weight: 950 !important;
      letter-spacing: .055em !important;
      white-space: nowrap !important;
    }
    .nav-links a.nym-start-here-primary:hover,
    .nav-links a.nym-start-here-primary.active,
    .home-nav-links a.nym-start-here-primary:hover,
    .home-nav-links a.nym-start-here-primary.active {
      background: #b8f34a !important;
      border-color: #080c0b !important;
      color: #080c0b !important;
      transform: translateY(-1px);
    }
    @media (max-width: 1050px) {
      .nav-links a.nym-start-here-primary,
      .home-nav-links a.nym-start-here-primary {
        min-height: 40px !important;
        padding: 0 14px !important;
        font-size: 11px !important;
      }
    }
  `;
  document.head.append(style);
}

function currentNymPageName() {
  return (window.location.pathname || "")
    .split("/")
    .filter(Boolean)
    .pop() || "index.html";
}

function setActiveIfCurrent(link, filename) {
  if (currentNymPageName() === filename) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
}

function ensureCoreNavigationLinks(navigation) {
  ensureMarketTickerStyles();
  const links = [...navigation.querySelectorAll("a")];

  let homeLink = links.find((item) => {
    const href = item.getAttribute("href") || "";
    return href === "index.html" || href.endsWith("/index.html") || href === "./";
  });
  if (!homeLink) {
    homeLink = document.createElement("a");
    homeLink.href = "index.html";
  }
  navigation.insertBefore(homeLink, navigation.firstChild);
  homeLink.classList.add("nym-home-link");
  homeLink.textContent = "HOME";
  homeLink.title = "Return to the Next Year’s Monsters homepage";
  homeLink.setAttribute("aria-label", "Return to the homepage");
  setActiveIfCurrent(homeLink, "index.html");

  let startLink = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes("start-here.html"),
  );
  if (!startLink) {
    startLink = document.createElement("a");
    startLink.href = "start-here.html";
  }
  homeLink.insertAdjacentElement("afterend", startLink);
  startLink.classList.add("nym-start-here-primary");
  startLink.textContent = "START HERE";
  startLink.title = "Open the plain-English guide to using this website";
  startLink.setAttribute("aria-label", "Open the Start Here website guide");
  setActiveIfCurrent(startLink, "start-here.html");
}

function ensureNavLink(navigation, href, label, title, filename) {
  let link = [...navigation.querySelectorAll("a")].find((item) =>
    item.getAttribute("href")?.includes(href),
  );
  if (!link) {
    link = document.createElement("a");
    link.href = href;
    navigation.append(link);
  }
  link.textContent = label;
  link.title = title;
  link.setAttribute("aria-label", title);
  setActiveIfCurrent(link, filename);
  return link;
}

function ensureMarketExplorerNavLink() {
  const navigation = document.querySelector("nav.nav-links");
  if (!navigation) return;

  ensureCoreNavigationLinks(navigation);
  ensureNavLink(navigation, "market-explorer.html", "FULL CHARTS", "Open full stock charts in Market Explorer", "market-explorer.html");
  ensureNavLink(navigation, "market-pulse.html", "MARKET PULSE", "Open Market Pulse", "market-pulse.html");
  ensureNavLink(navigation, "news-radar.html", "NEWS RADAR", "Open News Radar", "news-radar.html");
  ensureNavLink(navigation, "coverage-universe.html", "COVERAGE", "Open the stock coverage universe", "coverage-universe.html");
  ensureNavLink(navigation, "verification-ledger.html", "VERIFICATION", "Open the 15-stock verification ledger", "verification-ledger.html");
  ensureNavLink(navigation, "factory-status.html", "2,000-STOCK FACTORY", "Open the 2,000-stock factory status", "factory-status.html");
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
  section.setAttribute("aria-label", `${count}-stock external market ticker tape and Market Explorer shortcut`);

  const head = document.createElement("div");
  head.className = "nym-market-tape-head";

  const label = document.createElement("span");
  label.className = "nym-market-tape-label";
  label.textContent = `${count}-STOCK MARKET TAPE · EXTERNAL MARKET DATA`;

  const explorerLink = document.createElement("a");
  explorerLink.href = "market-explorer.html";
  explorerLink.textContent = "OPEN MARKET EXPLORER →";
  explorerLink.title = "Open full stock charts in Market Explorer";
  explorerLink.setAttribute("aria-label", "Open full stock charts in Market Explorer");
  head.append(label, explorerLink);

  const widgetShell = document.createElement("div");
  widgetShell.className = "nym-market-tape-widget";

  const tradingViewContainer = document.createElement("div");
  tradingViewContainer.className = "tradingview-widget-container";
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
    displayMode: "compact",
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
