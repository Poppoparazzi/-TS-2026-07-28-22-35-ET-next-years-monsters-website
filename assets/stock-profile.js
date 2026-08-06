// TS: 2026-08-04 22:18 ET

(() => {
  "use strict";

  const WATCHLIST_KEY = "nym-watchlist-v1";
  const PROVIDER_TIMEOUT_MS = 10_000;

  const bySelector = (selector) => document.querySelector(selector);

  function normalizeTicker(value) {
    const ticker = String(value ?? "").trim().toUpperCase();
    return /^[A-Z0-9.-]{1,15}$/.test(ticker) ? ticker : "";
  }

  function staticUrl(path) {
    return window.NYM_STATIC_URL?.(path) || path;
  }

  function apiBaseUrl() {
    const raw = window.NYM_CONFIG?.apiBaseUrl;
    if (typeof raw !== "string" || !raw.trim()) return "";
    try {
      const url = new URL(raw.trim());
      const local = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !local) return "";
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return "";
    }
  }

  async function requestJson(url, { allowNotFound = false } = {}) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(65_000),
    });
    if (allowNotFound && response.status === 404) return null;
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
    return payload;
  }

  async function loadStaticList(path) {
    const response = await fetch(staticUrl(path), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Unable to load ${path}.`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }

  function formatDate(value) {
    if (!value) return "Not recorded";
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  function tradingViewExchange(value) {
    const exchange = String(value ?? "").trim().toUpperCase();
    if (exchange.includes("NASDAQ")) return "NASDAQ";
    if (exchange === "NYSE" || exchange.includes("NEW YORK")) return "NYSE";
    if (exchange.includes("AMERICAN") || exchange === "AMEX") return "AMEX";
    if (exchange === "OTC") return "OTC";
    return "NASDAQ";
  }

  function tradingViewSymbol(model) {
    if (model.market?.proName) return String(model.market.proName).toUpperCase();
    const exchange = tradingViewExchange(model.company?.exchange || model.stored?.exchange || model.market?.exchange);
    return `${exchange}:${model.ticker}`;
  }

  function tradingViewUrl(model, section = "") {
    const symbol = tradingViewSymbol(model).replace(":", "-");
    return `https://www.tradingview.com/symbols/${symbol}/${section}`;
  }

  function setText(selector, value) {
    const node = bySelector(selector);
    if (node) node.textContent = String(value);
  }

  function createEvidenceBlock(label, title, text, link) {
    const block = document.createElement("article");
    block.className = "stock-evidence-block";

    const number = document.createElement("span");
    number.textContent = label;
    const heading = document.createElement("h3");
    heading.textContent = title;
    const copy = document.createElement("p");
    copy.textContent = text;
    block.append(number, heading, copy);

    if (link?.href) {
      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.textContent = link.label;
      if (link.external) {
        anchor.target = "_blank";
        anchor.rel = "noopener nofollow";
      }
      block.append(anchor);
    }
    return block;
  }

  function renderOverview(model) {
    const container = bySelector("[data-stock-overview]");
    if (!container) return;
    container.replaceChildren();

    const secText = model.company
      ? `${model.company.companyName} is matched to CIK ${model.company.cikPadded || model.company.cik}.`
      : model.apiConnected
        ? "No official SEC ticker identity was returned."
        : "The official SEC service could not be reached in this session.";
    const latestFiling = model.stored?.latestFiling;
    const filingText = latestFiling
      ? `${latestFiling.form} filed ${formatDate(latestFiling.filingDate)}. ${model.stored.filingCount} filing record(s) and ${model.stored.factCount} company fact(s) are stored.`
      : "No stored filing summary is available for this ticker.";
    const ratingText = model.demo
      ? `${model.demo.score} / 100 · ${model.demo.tier}. Historical Demonstration Rating from the approved VCL™ record.`
      : "Not Yet Rated. No production Monster Rating™ has been calculated or invented.";

    container.append(
      createEvidenceBlock("01 / IDENTITY", model.company ? "OFFICIAL SEC EVIDENCE" : "IDENTITY STATUS", secText, model.company ? { href: model.company.sourceUrl, label: "OPEN OFFICIAL SOURCE ↗", external: true } : null),
      createEvidenceBlock("02 / FILINGS", latestFiling ? "LATEST STORED FILING" : "FILING STATUS", filingText, latestFiling ? { href: latestFiling.primaryDocumentUrl, label: "OPEN FILING ↗", external: true } : null),
      createEvidenceBlock("03 / MARKET", "EXTERNAL MARKET CONTEXT", "The chart and current stories come from an external tool and may be delayed or blocked. They do not create a production rating.", { href: tradingViewUrl(model), label: "OPEN EXTERNAL SOURCE ↗", external: true }),
      createEvidenceBlock("04 / RATING", model.demo ? "DEMONSTRATION RATING" : "NOT YET RATED", ratingText),
    );
  }

  function createIdentityDatum(label, value) {
    const item = document.createElement("div");
    const name = document.createElement("span");
    name.textContent = label;
    const content = document.createElement("strong");
    content.textContent = value;
    item.append(name, content);
    return item;
  }

  function renderSecEvidence(model) {
    const container = bySelector("[data-stock-sec]");
    if (!container) return;
    container.replaceChildren();

    if (!model.company) {
      const message = document.createElement("p");
      message.className = "stock-error";
      message.textContent = model.apiConnected
        ? `Unresolved SEC Identity: no official company mapping was returned for ${model.ticker}.`
        : "Provider Not Connected: official SEC evidence could not be loaded. No company identity was invented.";
      container.append(message);
      return;
    }

    const identity = document.createElement("div");
    identity.className = "stock-sec-identity";
    identity.append(
      createIdentityDatum("OFFICIAL COMPANY", model.company.companyName),
      createIdentityDatum("TICKER", model.company.ticker),
      createIdentityDatum("CIK", model.company.cikPadded || String(model.company.cik)),
      createIdentityDatum("EXCHANGE", model.company.exchange || "Not supplied by SEC mapping"),
    );

    const source = document.createElement("p");
    const sourceLink = document.createElement("a");
    sourceLink.className = "stock-sec-source";
    sourceLink.href = model.company.sourceUrl;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    sourceLink.textContent = "OPEN THE OFFICIAL SEC COMPANY-TICKER SOURCE ↗";
    source.append(sourceLink);

    const filings = document.createElement("div");
    filings.className = "stock-filings";
    const records = Array.isArray(model.filings?.filings) ? model.filings.filings : [];
    if (!records.length) {
      const message = document.createElement("p");
      message.className = "stock-loading";
      message.textContent = "No recent filing list was returned in this session.";
      filings.append(message);
    } else {
      records.forEach((filing) => {
        const row = document.createElement("article");
        row.className = "stock-filing-row";
        const form = document.createElement("strong");
        form.textContent = filing.form || "FILING";
        const filed = document.createElement("span");
        filed.textContent = formatDate(filing.filingDate);
        const documentName = document.createElement("span");
        documentName.textContent = filing.primaryDocument || filing.accessionNumber || "Official filing document";
        const link = document.createElement("a");
        link.href = filing.primaryDocumentUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "OPEN ↗";
        row.append(form, filed, documentName, link);
        filings.append(row);
      });
    }

    container.append(identity, source, filings);
  }

  function providerFallback(container, model, kind) {
    container.replaceChildren();
    const wrapper = document.createElement("div");
    wrapper.className = "stock-provider-fallback";
    const inner = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = "PROVIDER NOT CONNECTED";
    const text = document.createElement("p");
    text.textContent = `The external ${kind} could not be displayed here. No price, story, timestamp, or rating impact was invented.`;
    const link = document.createElement("a");
    link.href = kind === "stories" ? tradingViewUrl(model, "news/") : tradingViewUrl(model);
    link.target = "_blank";
    link.rel = "noopener nofollow";
    link.textContent = `OPEN ${model.ticker} ${kind.toUpperCase()} DIRECTLY ↗`;
    inner.append(heading, text, link);
    wrapper.append(inner);
    container.append(wrapper);
  }

  function mountProviderWidget(container, model, kind) {
    if (!container || container.dataset.mounted === "true") return;
    container.dataset.mounted = "true";
    container.replaceChildren();

    const shell = document.createElement("div");
    shell.className = "tradingview-widget-container";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.onerror = () => providerFallback(container, model, kind);

    if (kind === "stories") {
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
      script.textContent = JSON.stringify({
        displayMode: "regular",
        feedMode: "symbol",
        symbol: tradingViewSymbol(model),
        colorTheme: "dark",
        isTransparent: true,
        locale: "en",
        width: "100%",
        height: 570,
      });
    } else {
      script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
      script.textContent = JSON.stringify({
        symbols: [[model.name, `${tradingViewSymbol(model)}|1D`]],
        chartOnly: false,
        width: "100%",
        height: 570,
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
    }

    shell.append(widget, script);
    container.append(shell);
    window.setTimeout(() => {
      if (!container.querySelector("iframe")) providerFallback(container, model, kind);
    }, PROVIDER_TIMEOUT_MS);
  }

  function renderRating(model) {
    const container = bySelector("[data-stock-rating]");
    if (!container) return;
    container.replaceChildren();

    const wrapper = document.createElement("article");
    wrapper.className = "stock-rating-state";
    if (!model.demo) {
      const copy = document.createElement("div");
      copy.className = "stock-rating-copy";
      const label = document.createElement("span");
      label.textContent = "NOT YET RATED";
      const heading = document.createElement("h3");
      heading.textContent = "NO PRODUCTION SCORE HAS BEEN CALCULATED.";
      const text = document.createElement("p");
      text.textContent = "Official SEC evidence can still be reviewed above. A Monster Rating™ will remain absent until an approved, versioned scoring engine has enough permitted data to calculate it.";
      const history = document.createElement("p");
      history.textContent = `${model.stored?.ratingCount || 0} verified production rating-history record(s) are stored for this company.`;
      copy.append(label, heading, text, history);
      wrapper.append(copy);
      container.append(wrapper);
      return;
    }

    const score = document.createElement("div");
    score.className = "stock-score";
    const scoreLabel = document.createElement("span");
    scoreLabel.textContent = "DEMONSTRATION RATING";
    const number = document.createElement("strong");
    number.textContent = String(model.demo.score);
    const tier = document.createElement("em");
    tier.textContent = model.demo.tier;
    score.append(scoreLabel, number, tier);

    const copy = document.createElement("div");
    copy.className = "stock-rating-copy";
    const label = document.createElement("span");
    label.textContent = "APPROVED VCL™ HISTORICAL DEMONSTRATION";
    const heading = document.createElement("h3");
    heading.textContent = "THE SCORE OPENS THE EVIDENCE.";
    const why = document.createElement("p");
    why.textContent = model.demo.why;
    const risk = document.createElement("p");
    risk.textContent = `Risk: ${model.demo.warning}`;
    const dna = document.createElement("div");
    dna.className = "stock-dna";
    (model.demo.dna || []).forEach((trait) => {
      const item = document.createElement("span");
      item.textContent = trait;
      dna.append(item);
    });
    const history = document.createElement("p");
    history.textContent = `${model.stored?.ratingCount || 0} verified production rating-history record(s) are stored. This demonstration is not a current production rating.`;
    const actions = document.createElement("div");
    actions.className = "stock-rating-actions";
    const check = document.createElement("a");
    check.href = `monster-check.html?ticker=${encodeURIComponent(model.ticker)}`;
    check.textContent = "OPEN FULL DEMONSTRATION CHECK";
    const library = document.createElement("a");
    library.href = "vcl-library.html#case-library";
    library.textContent = "OPEN THE VCL™ LIBRARY";
    actions.append(check, library);
    copy.append(label, heading, why, risk, dna, history, actions);
    wrapper.append(score, copy);
    container.append(wrapper);
  }

  function readWatchlist() {
    try {
      const stored = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
      return new Set(Array.isArray(stored) ? stored.map(normalizeTicker).filter(Boolean) : []);
    } catch (_error) {
      return new Set();
    }
  }

  function writeWatchlist(watchlist) {
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...watchlist].sort()));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function setupWatchlist(ticker) {
    const button = bySelector("[data-stock-watch]");
    if (!button) return;
    const watchlist = readWatchlist();

    const update = () => {
      const active = watchlist.has(ticker);
      button.setAttribute("aria-pressed", String(active));
      button.innerHTML = `<span aria-hidden="true">${active ? "★" : "☆"}</span> ${active ? "IN WATCHLIST" : "ADD TO WATCHLIST"}`;
    };

    button.addEventListener("click", () => {
      if (watchlist.has(ticker)) watchlist.delete(ticker);
      else watchlist.add(ticker);
      writeWatchlist(watchlist);
      update();
    });
    update();
  }

  function setupTabs(model) {
    const tabs = [...document.querySelectorAll("[data-stock-tab]")];
    const panels = [...document.querySelectorAll("[data-stock-panel]")];

    const activate = (name, focus = false) => {
      tabs.forEach((tab) => {
        const active = tab.dataset.stockTab === name;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      });
      panels.forEach((panel) => { panel.hidden = panel.dataset.stockPanel !== name; });
      const url = new URL(window.location.href);
      url.hash = name === "overview" ? "" : name;
      window.history.replaceState({}, "", url);

      if (name === "chart") mountProviderWidget(bySelector("[data-stock-chart]"), model, "chart");
      if (name === "stories") mountProviderWidget(bySelector("[data-stock-stories]"), model, "stories");
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab.dataset.stockTab || "overview"));
      tab.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const next = (index + direction + tabs.length) % tabs.length;
        activate(tabs[next].dataset.stockTab || "overview", true);
      });
    });

    const requested = window.location.hash.replace("#", "");
    activate(tabs.some((tab) => tab.dataset.stockTab === requested) ? requested : "overview");
  }

  function setupSearch(ticker) {
    const form = bySelector("[data-stock-search]");
    const input = bySelector("[data-stock-search-input]");
    if (!form || !input) return;
    input.value = ticker;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const nextTicker = normalizeTicker(input.value);
      if (!nextTicker) {
        input.setCustomValidity("Enter an exact ticker using letters, numbers, a period, or a hyphen.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      window.location.href = `stock.html?ticker=${encodeURIComponent(nextTicker)}`;
    });
  }

  async function startStockProfile() {
    const requested = new URLSearchParams(window.location.search).get("ticker") || "AAPL";
    const ticker = normalizeTicker(requested);
    if (!ticker) {
      setText("[data-stock-ticker]", "$—");
      setText("[data-stock-name]", "INVALID TICKER");
      setText("[data-stock-sec-status]", "NOT CHECKED");
      setText("[data-stock-rating-status]", "NOT CHECKED");
      const overview = bySelector("[data-stock-overview]");
      if (overview) overview.innerHTML = '<p class="stock-error">Enter a valid U.S. ticker containing letters, numbers, a period, or a hyphen.</p>';
      return;
    }

    setupSearch(ticker);
    setupWatchlist(ticker);
    setText("[data-stock-ticker]", `$${ticker}`);

    const baseUrl = apiBaseUrl();
    const [demoResult, marketResult, companyResult, storedResult, filingsResult] = await Promise.allSettled([
      loadStaticList("data/stocks.json"),
      loadStaticList("data/market-universe.json"),
      baseUrl ? requestJson(`${baseUrl}/api/sec/company/${encodeURIComponent(ticker)}`, { allowNotFound: true }) : Promise.reject(new Error("API unavailable")),
      baseUrl ? requestJson(`${baseUrl}/api/stored/${encodeURIComponent(ticker)}`, { allowNotFound: true }) : Promise.reject(new Error("API unavailable")),
      baseUrl ? requestJson(`${baseUrl}/api/sec/filings/${encodeURIComponent(ticker)}?limit=8`, { allowNotFound: true }) : Promise.reject(new Error("API unavailable")),
    ]);

    const demos = demoResult.status === "fulfilled" ? demoResult.value : [];
    const markets = marketResult.status === "fulfilled" ? marketResult.value : [];
    const company = companyResult.status === "fulfilled" ? companyResult.value : null;
    const stored = storedResult.status === "fulfilled" ? storedResult.value : null;
    const filings = filingsResult.status === "fulfilled" ? filingsResult.value : null;
    const demo = demos.find((item) => normalizeTicker(item.ticker) === ticker) || null;
    const market = markets.find((item) => normalizeTicker(item.ticker) === ticker) || null;
    const name = company?.companyName || stored?.companyName || demo?.name || market?.name || ticker;
    const model = {
      ticker,
      name,
      demo,
      market,
      company,
      stored,
      filings,
      apiConnected: companyResult.status === "fulfilled",
    };

    document.title = `${ticker} ${name} | Next Year’s Monsters™`;
    setText("[data-stock-name]", name);
    const meta = bySelector("[data-stock-meta]");
    if (meta) {
      meta.replaceChildren();
      [company?.exchange || stored?.exchange, company ? `CIK ${company.cikPadded || company.cik}` : null, demo ? "VCL™ DEMONSTRATION" : "NOT YET RATED"]
        .filter(Boolean)
        .forEach((value) => {
          const item = document.createElement("span");
          item.textContent = String(value);
          meta.append(item);
        });
    }

    setText("[data-stock-sec-status]", company ? "OFFICIAL · CONNECTED" : model.apiConnected ? "UNRESOLVED IDENTITY" : "PROVIDER NOT CONNECTED");
    setText("[data-stock-rating-status]", demo ? `${demo.score} · DEMONSTRATION` : "NOT YET RATED");
    renderOverview(model);
    renderSecEvidence(model);
    renderRating(model);
    setupTabs(model);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void startStockProfile());
  } else {
    void startStockProfile();
  }
})();
