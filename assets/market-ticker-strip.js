// TS: 2026-08-04 22:18 ET

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
    const response = await fetch(window.NYM_STATIC_URL?.("data/market-universe.json") || "data/market-universe.json");
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
    link.href = "assets/market-ticker-strip.css";
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
    @media (max-width: 1180px) {
      .nav-links a.nym-start-here-primary,
      .home-nav-links a.nym-start-here-primary {
        min-height: 40px !important;
        padding: 0 14px !important;
        font-size: 11px !important;
      }
      .home-nav-shell {
        grid-template-columns: minmax(0, 1fr) auto auto !important;
        gap: 12px !important;
      }
      .home-nav-links {
        display: none !important;
      }
      .nym-mobile-menu {
        display: block !important;
      }
    }
    .nym-tools-menu,
    .nym-mobile-menu {
      position: relative;
    }
    .nym-tools-menu summary,
    .nym-mobile-menu summary {
      display: inline-flex;
      min-height: 42px;
      align-items: center;
      justify-content: center;
      border-bottom: 2px solid transparent;
      color: #080c0b;
      font-size: 12px;
      font-weight: 950;
      cursor: pointer;
      list-style: none;
    }
    .nym-tools-menu summary::-webkit-details-marker,
    .nym-mobile-menu summary::-webkit-details-marker {
      display: none;
    }
    .nym-tools-menu summary::after,
    .nym-mobile-menu summary::after {
      margin-left: 7px;
      content: "▾";
      font-size: 10px;
    }
    .nym-tools-menu[open] summary,
    .nym-tools-menu summary:hover,
    .nym-tools-menu summary:focus-visible,
    .nym-mobile-menu[open] summary,
    .nym-mobile-menu summary:hover,
    .nym-mobile-menu summary:focus-visible {
      border-bottom-color: var(--editorial-red, #ef3528);
      outline: 0;
    }
    .nym-tools-panel,
    .nym-mobile-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      z-index: 200;
      display: grid;
      width: 270px;
      border: 2px solid #080c0b;
      background: #f7f1e5;
      box-shadow: 8px 8px 0 rgba(8,12,11,.24);
    }
    .nym-tools-panel a,
    .nym-mobile-panel a {
      min-height: 43px;
      padding: 13px 16px !important;
      border: 0 !important;
      border-bottom: 1px solid rgba(8,12,11,.2) !important;
      color: #080c0b !important;
      font-size: 11px !important;
      font-weight: 900 !important;
      text-decoration: none;
    }
    .nym-tools-panel a:last-child,
    .nym-mobile-panel a:last-child {
      border-bottom: 0 !important;
    }
    .nym-tools-panel a:hover,
    .nym-tools-panel a:focus-visible,
    .nym-mobile-panel a:hover,
    .nym-mobile-panel a:focus-visible,
    .nym-tools-panel a.active,
    .nym-mobile-panel a.active {
      background: var(--editorial-lime, #a8df34) !important;
      outline: 0;
    }
    .nym-mobile-menu {
      display: none;
    }
    .nym-mobile-menu summary {
      min-width: 70px;
      border: 2px solid #080c0b;
      padding: 0 12px;
    }
    .nym-mobile-panel {
      width: min(320px, calc(100vw - 24px));
      max-height: calc(100vh - 100px);
      overflow-y: auto;
    }
    @media (max-width: 650px) {
      .home-nav-cta {
        display: none !important;
      }
      .home-nav-shell {
        grid-template-columns: minmax(0, 1fr) auto !important;
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

function setActiveIfCurrent(link, filenames) {
  const current = currentNymPageName();
  const accepted = Array.isArray(filenames) ? filenames : [filenames];
  if (accepted.includes(current)) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }
}

const NYM_PRIMARY_NAV = Object.freeze([
  { href: "index.html", label: "HOME", title: "Return to the homepage", files: ["index.html"] },
  { href: "coverage-universe.html", label: "FIND STOCKS", title: "Search the public stock universe", files: ["coverage-universe.html", "stock.html"] },
  { href: "monster-check.html", label: "MONSTER CHECK", title: "Open Monster Check", files: ["monster-check.html"] },
  { href: "vcl-library.html", label: "VCL™", title: "Open the Visual Case Library", files: ["vcl-library.html"] },
  { href: "start-here.html", label: "START HERE", title: "Open the plain-English website guide", files: ["start-here.html"], className: "nym-start-here-primary" },
]);

const NYM_TOOL_NAV = Object.freeze([
  { href: "market-explorer.html", label: "FULL CHARTS", title: "Open full stock charts", files: ["market-explorer.html"] },
  { href: "market-pulse.html", label: "MARKET PULSE", title: "Open Market Pulse", files: ["market-pulse.html"] },
  { href: "news-radar.html", label: "NEWS RADAR", title: "Open News Radar", files: ["news-radar.html"] },
  { href: "top-monsters.html", label: "TOP MONSTERS", title: "Open demonstration leaders", files: ["top-monsters.html"] },
  { href: "verification-ledger.html", label: "VERIFICATION", title: "Open the 15-stock verification ledger", files: ["verification-ledger.html"] },
  { href: "live-status.html", label: "DATA STATUS", title: "Open production data status", files: ["live-status.html"] },
  { href: "factory-status.html", label: "2,000-STOCK FACTORY", title: "Open the public stock factory", files: ["factory-status.html"] },
  { href: "how-it-works.html", label: "HOW IT WORKS", title: "Open the evidence system", files: ["how-it-works.html"] },
  { href: "about.html", label: "ABOUT", title: "About Next Year’s Monsters", files: ["about.html"] },
]);

function createNymNavLink(item) {
  const link = document.createElement("a");
  link.href = item.href;
  link.textContent = item.label;
  link.title = item.title;
  link.setAttribute("aria-label", item.title);
  if (item.className) link.classList.add(item.className);
  if (item.href === "index.html") link.classList.add("nym-home-link");
  setActiveIfCurrent(link, item.files);
  return link;
}

function appendNymMenuLinks(container, items) {
  items.forEach((item) => container.append(createNymNavLink(item)));
}

function createNymDetails(className, panelClass, label, items) {
  const details = document.createElement("details");
  details.className = className;
  const summary = document.createElement("summary");
  summary.textContent = label;
  const panel = document.createElement("div");
  panel.className = panelClass;
  appendNymMenuLinks(panel, items);
  details.append(summary, panel);
  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) details.open = false;
  });
  return details;
}

function ensureMarketExplorerNavLink() {
  const navigation = document.querySelector("nav.nav-links");
  if (!navigation) return;

  ensureMarketTickerStyles();
  navigation.replaceChildren();
  appendNymMenuLinks(navigation, NYM_PRIMARY_NAV);
  navigation.append(createNymDetails("nym-tools-menu", "nym-tools-panel", "TOOLS", NYM_TOOL_NAV));

  const shell = navigation.closest(".home-nav-shell") || navigation.parentElement;
  if (!shell) return;
  shell.querySelector(".nym-mobile-menu")?.remove();
  shell.append(createNymDetails("nym-mobile-menu", "nym-mobile-panel", "MENU", [...NYM_PRIMARY_NAV, ...NYM_TOOL_NAV]));
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
  section.append(head, widgetShell);
  header.insertAdjacentElement("afterend", section);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void createMarketTickerStrip());
} else {
  void createMarketTickerStrip();
}
