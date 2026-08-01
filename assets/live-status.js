// TS: 2026-08-01 15:14 ET

const STATUS_CONFIG = window.NYM_CONFIG ?? {};
const TRADINGVIEW_EXCHANGE_OVERRIDES = Object.freeze({
  DECK: "NYSE",
  VRT: "NYSE",
});

function statusEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getStatusApiBaseUrl() {
  const raw = typeof STATUS_CONFIG.apiBaseUrl === "string" ? STATUS_CONFIG.apiBaseUrl.trim() : "";
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localDevelopment) return null;
    return url.href.replace(/\/$/, "");
  } catch (_error) {
    return null;
  }
}

function formatStatusTimestamp(value) {
  if (!value) return "No successful live update yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Live timestamp unavailable";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function statusCheck(label, ready, detail) {
  return `
    <div class="status-check ${ready ? "status-check-ready" : "status-check-pending"}">
      <span aria-hidden="true">${ready ? "✓" : "○"}</span>
      <div><strong>${statusEscape(label)}</strong><small>${statusEscape(detail)}</small></div>
    </div>`;
}

function staticCompanyReadiness() {
  return {
    hasVerifiedQuote: false,
    quoteIsUsable: false,
    hasSecStatus: false,
    hasSavedVersionedRating: false,
    hasRatingEvidence: false,
    isLiveReady: false,
    lastSuccessfulUpdate: null,
  };
}

function statusRow(stock, index, readiness) {
  const firstTarget = stock.ticker === "AAPL";
  const company = readiness ?? staticCompanyReadiness();
  const quoteReady = Boolean(company.hasVerifiedQuote && company.quoteIsUsable);
  const ratingReady = Boolean(company.hasSavedVersionedRating && company.hasRatingEvidence);

  const quoteDetail = quoteReady
    ? `Saved · ${formatStatusTimestamp(company.lastSuccessfulUpdate)}`
    : company.hasVerifiedQuote
      ? "Saved quote is stale or unusable"
      : "Not saved yet";
  const secDetail = company.hasSecStatus ? "Official filing status saved" : "Not saved yet";
  const ratingDetail = ratingReady
    ? "Versioned rating and evidence saved"
    : company.hasSavedVersionedRating
      ? "Rating saved; evidence incomplete"
      : "Version 1 not calculated";

  let resultTitle = "PENDING";
  let resultDetail = "Follows after the first ticker passes twice.";

  if (company.isLiveReady) {
    resultTitle = "LIVE READY";
    resultDetail = formatStatusTimestamp(company.lastSuccessfulUpdate);
  } else if (firstTarget) {
    resultTitle = "FIRST TECHNICAL TARGET";
    resultDetail = "AAPL tests the complete live path first. This is not a recommendation.";
  }

  return `
    <article class="status-row">
      <div class="status-company">
        <strong>${String(index + 1).padStart(2, "0")} · $${statusEscape(stock.ticker)}</strong>
        <span>${statusEscape(stock.name)} · ${statusEscape(stock.sector)}</span>
      </div>
      ${statusCheck("DEMO PROFILE", true, "Published")}
      ${statusCheck("USABLE QUOTE", quoteReady, quoteDetail)}
      ${statusCheck("SEC CHECK", Boolean(company.hasSecStatus), secDetail)}
      ${statusCheck("LIVE RATING", ratingReady, ratingDetail)}
      <div class="status-result">
        <strong>${statusEscape(resultTitle)}</strong>
        <span>${statusEscape(resultDetail)}</span>
      </div>
    </article>`;
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function renderSummary(stocks, snapshot) {
  const total = stocks.length;
  const companies = Array.isArray(snapshot?.companies) ? snapshot.companies : [];
  const usableQuotes = companies.filter((company) => company.hasVerifiedQuote && company.quoteIsUsable).length;
  const secChecks = companies.filter((company) => company.hasSecStatus).length;
  const liveRatings = companies.filter(
    (company) => company.hasSavedVersionedRating && company.hasRatingEvidence,
  ).length;
  const openSlots = Number.isFinite(Number(snapshot?.top25?.companiesStillToAdd))
    ? Number(snapshot.top25.companiesStillToAdd)
    : 10;

  setText("[data-demo-count]", `${total}/${total}`);
  setText("[data-quote-count]", `${usableQuotes}/${total}`);
  setText("[data-sec-count]", `${secChecks}/${total}`);
  setText("[data-rating-count]", `${liveRatings}/${total}`);
  setText("[data-open-slot-count]", String(openSlots));

  if (!snapshot) return;

  const ready = Number(snapshot.pilot?.readyCompanyCount ?? 0);
  const lastUpdated = formatStatusTimestamp(snapshot.pilot?.lastSuccessfulUpdate);

  if (snapshot.pilot?.isLiveReady) {
    setText("[data-readiness-headline]", "ORIGINAL 15: LIVE VERIFIED");
    setText(
      "[data-readiness-message]",
      `All 15 pilot stocks passed the saved quote, SEC, rating, evidence, and timestamp checks. Last successful update: ${lastUpdated}.`,
    );
  } else if (ready > 0) {
    setText("[data-readiness-headline]", `${ready}/${total} PILOT STOCKS LIVE READY`);
    setText(
      "[data-readiness-message]",
      `${snapshot.pilot.pendingCompanyCount} pilot stocks remain pending. Last successful saved update: ${lastUpdated}.`,
    );
  } else {
    setText("[data-readiness-headline]", "NEXT VISIBLE RESULT: AAPL LIVE TEST");
    setText(
      "[data-readiness-message]",
      "The readiness API is connected, but no pilot ticker has passed every saved-data check yet. AAPL remains the first technical target.",
    );
  }
}

function tradingViewSymbol(stock) {
  const ticker = String(stock.ticker).toUpperCase();
  const exchange = TRADINGVIEW_EXCHANGE_OVERRIDES[ticker] ?? "NASDAQ";
  return `${exchange}:${ticker}`;
}

function renderMarketSnapshot(stock) {
  const frame = document.querySelector("[data-market-widget]");
  if (!frame) return;

  const ticker = String(stock.ticker).toUpperCase();
  const symbol = tradingViewSymbol(stock);
  const tradingViewPath = symbol.replace(":", "-");

  setText("[data-market-ticker]", ticker);
  setText("[data-market-selected]", `${stock.name} · ${stock.sector}`);

  const checkLink = document.querySelector("[data-market-check-link]");
  if (checkLink) {
    checkLink.href = `monster-check.html?ticker=${encodeURIComponent(ticker)}`;
    checkLink.textContent = `OPEN ${ticker} MONSTER CHECK™`;
  }

  const select = document.querySelector("[data-market-select]");
  if (select && select.value !== ticker) select.value = ticker;

  document.querySelectorAll("[data-market-symbol]").forEach((button) => {
    const active = button.dataset.marketSymbol === ticker;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

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

function setupMarketExplorer(stocks) {
  const select = document.querySelector("[data-market-select]");
  const buttons = document.querySelector("[data-market-buttons]");
  if (!select || !buttons || stocks.length === 0) return;

  const byTicker = new Map(stocks.map((stock) => [String(stock.ticker).toUpperCase(), stock]));

  select.replaceChildren();
  buttons.replaceChildren();

  stocks.forEach((stock) => {
    const ticker = String(stock.ticker).toUpperCase();

    const option = document.createElement("option");
    option.value = ticker;
    option.textContent = `${ticker} · ${stock.name}`;
    select.append(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "snapshot-stock-button";
    button.dataset.marketSymbol = ticker;
    button.setAttribute("aria-pressed", "false");
    button.textContent = ticker;
    button.addEventListener("click", () => renderMarketSnapshot(stock));
    buttons.append(button);
  });

  select.addEventListener("change", () => {
    const stock = byTicker.get(String(select.value).toUpperCase());
    if (stock) renderMarketSnapshot(stock);
  });

  renderMarketSnapshot(byTicker.get("AAPL") ?? stocks[0]);
}

async function fetchReadinessSnapshot(apiBaseUrl) {
  const response = await fetch(`${apiBaseUrl}/api/readiness`, {
    headers: { Accept: "application/json" },
    // Render's free service can need roughly a minute to wake after inactivity.
    signal: AbortSignal.timeout(65_000),
  });

  if (!response.ok) {
    throw new Error(`Readiness API returned HTTP ${response.status}.`);
  }

  return response.json();
}

async function setupLiveStatus() {
  const list = document.querySelector("[data-status-list]");
  if (!list) return;

  try {
    const response = await fetch("data/stocks.json");
    if (!response.ok) throw new Error("Unable to load the pilot stock list.");

    const stocks = await response.json();
    const ordered = [...stocks].sort((left, right) => left.ticker.localeCompare(right.ticker));
    setupMarketExplorer(ordered);

    const apiBaseUrl = getStatusApiBaseUrl();
    let snapshot = null;

    if (apiBaseUrl) {
      try {
        snapshot = await fetchReadinessSnapshot(apiBaseUrl);
      } catch (_error) {
        setText("[data-readiness-headline]", "LIVE READINESS API UNAVAILABLE");
        setText(
          "[data-readiness-message]",
          "The public page could not read saved rollout progress. It is showing the repository checklist and is not substituting invented completion values.",
        );
      }
    }

    const readinessByTicker = new Map(
      (snapshot?.companies ?? []).map((company) => [String(company.ticker).toUpperCase(), company]),
    );

    list.innerHTML = ordered
      .map((stock, index) => statusRow(stock, index, readinessByTicker.get(stock.ticker)))
      .join("");
    renderSummary(ordered, snapshot);
  } catch (_error) {
    list.innerHTML = "<p class=\"leaderboard-empty\">The live rollout checklist could not load its stock list. No completion status was invented.</p>";
  }
}

document.addEventListener("DOMContentLoaded", setupLiveStatus);
