// TS: 2026-08-01 15:14 ET

(() => {
  const CONFIG = window.NYM_CONFIG ?? {};
  const rawBaseUrl = typeof CONFIG.apiBaseUrl === "string" ? CONFIG.apiBaseUrl.trim() : "";
  const requestState = new WeakMap();

  function getApiBaseUrl() {
    if (!rawBaseUrl) return null;

    try {
      const url = new URL(rawBaseUrl);
      const localDevelopment = ["localhost", "127.0.0.1"].includes(url.hostname);
      if (url.protocol !== "https:" && !localDevelopment) return null;
      return url.href.replace(/\/$/, "");
    } catch (_error) {
      return null;
    }
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return;

  function extractTicker(result) {
    const tickerNode = result.querySelector(".monster-result-identity h2 span");
    return tickerNode?.textContent?.replace("$", "").trim().toUpperCase() || null;
  }

  async function requestJson(path) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      headers: { Accept: "application/json" },
      // Render's free service can need roughly a minute to wake after inactivity.
      signal: AbortSignal.timeout(65_000),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message = payload?.message || `Live API returned HTTP ${response.status}.`;
      throw new Error(message);
    }

    return response.json();
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatMoney(value, currency = "USD") {
    const number = finiteNumber(value);
    if (number === null) return "Unavailable";

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  function formatSigned(value, suffix = "") {
    const number = finiteNumber(value);
    if (number === null) return "Unavailable";

    const sign = number > 0 ? "+" : "";
    return `${sign}${number.toFixed(2)}${suffix}`;
  }

  function formatTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Timestamp unavailable";

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }

  function createLiveStrip(result, ticker) {
    result.querySelector("[data-live-data-strip]")?.remove();

    const section = document.createElement("section");
    section.className = "monster-live-strip";
    section.dataset.liveDataStrip = "";
    section.dataset.liveStatus = "loading";
    section.setAttribute("aria-live", "polite");
    section.innerHTML = `
      <div class="monster-live-label">
        <span>LIVE DATA CONNECTION</span>
        <strong data-live-symbol></strong>
      </div>
      <div class="monster-live-metric">
        <span>CURRENT PRICE</span>
        <strong data-live-price>Connecting…</strong>
        <em data-live-change></em>
      </div>
      <div class="monster-live-metric">
        <span>QUOTE STATUS</span>
        <strong data-live-freshness>Checking provider…</strong>
        <em data-live-time></em>
      </div>
      <div class="monster-live-metric monster-live-filing">
        <span>LATEST SEC FILING</span>
        <strong data-live-filing-form>Checking EDGAR…</strong>
        <a data-live-filing-link target="_blank" rel="noopener noreferrer"></a>
      </div>
      <p class="monster-live-disclosure" data-live-disclosure></p>`;

    section.querySelector("[data-live-symbol]").textContent = `$${ticker}`;
    const anchor = result.querySelector(".monster-result-head");
    anchor?.insertAdjacentElement("afterend", section);
    return section;
  }

  function renderQuote(section, quote) {
    section.querySelector("[data-live-price]").textContent = formatMoney(
      quote.price,
      quote.currency || "USD",
    );
    section.querySelector("[data-live-change]").textContent = `${formatSigned(
      quote.change,
    )} · ${formatSigned(quote.percentChange, "%")}`;
    section.querySelector("[data-live-freshness]").textContent = String(
      quote.freshness || "Unknown freshness",
    ).toUpperCase();
    section.querySelector("[data-live-time]").textContent = formatTimestamp(
      quote.providerTimestamp || quote.retrievedAt,
    );
    section.querySelector("[data-live-disclosure]").textContent =
      quote.feedDisclosure || "Live provider disclosure unavailable.";
  }

  function renderFiling(section, filingResponse) {
    const filing = Array.isArray(filingResponse?.filings) ? filingResponse.filings[0] : null;
    const formNode = section.querySelector("[data-live-filing-form]");
    const linkNode = section.querySelector("[data-live-filing-link]");

    if (!filing) {
      formNode.textContent = "No recent filing returned";
      linkNode.removeAttribute("href");
      linkNode.textContent = "";
      return;
    }

    formNode.textContent = `${filing.form} · ${filing.filingDate}`;
    linkNode.href = filing.primaryDocumentUrl;
    linkNode.textContent = "OPEN OFFICIAL SEC DOCUMENT ↗";
  }

  function renderQuoteUnavailable(section) {
    section.querySelector("[data-live-price]").textContent = "Not connected";
    section.querySelector("[data-live-change]").textContent = "Demonstration rating remains below.";
    section.querySelector("[data-live-freshness]").textContent = "MARKET DATA NOT CONNECTED";
    section.querySelector("[data-live-time]").textContent = "No live value was substituted.";
  }

  function renderFilingUnavailable(section) {
    section.querySelector("[data-live-filing-form]").textContent = "SEC connection unavailable";
    section.querySelector("[data-live-filing-link]").textContent = "";
  }

  async function refreshLiveData(result, ticker) {
    const prior = requestState.get(result) ?? { generation: 0, ticker: null };
    const generation = prior.generation + 1;
    requestState.set(result, { generation, ticker });

    const section = createLiveStrip(result, ticker);
    const [quoteResult, filingResult] = await Promise.allSettled([
      requestJson(`/api/quotes/${encodeURIComponent(ticker)}`),
      requestJson(`/api/sec/filings/${encodeURIComponent(ticker)}?limit=1`),
    ]);

    const current = requestState.get(result);
    if (!current || current.generation !== generation || current.ticker !== ticker) return;

    const quoteLoaded = quoteResult.status === "fulfilled";
    const filingLoaded = filingResult.status === "fulfilled";

    if (quoteLoaded) {
      renderQuote(section, quoteResult.value);
    } else {
      renderQuoteUnavailable(section);
    }

    if (filingLoaded) {
      renderFiling(section, filingResult.value);
    } else {
      renderFilingUnavailable(section);
    }

    if (quoteLoaded && filingLoaded) {
      section.dataset.liveStatus = "live";
    } else if (quoteLoaded || filingLoaded) {
      section.dataset.liveStatus = "partial";

      if (filingLoaded) {
        section.querySelector("[data-live-disclosure]").textContent =
          "Official SEC filing loaded. Market quote remains disconnected, and the demonstration rating below was not changed.";
      }
    } else {
      section.dataset.liveStatus = "unavailable";
      section.querySelector("[data-live-disclosure]").textContent =
        quoteResult.reason?.message ||
        filingResult.reason?.message ||
        "The live services could not be reached. No live value was substituted.";
    }
  }

  function inspectResult(result) {
    const ticker = extractTicker(result);
    if (!ticker) return;

    const prior = requestState.get(result);
    const stripExists = Boolean(result.querySelector("[data-live-data-strip]"));
    if (prior?.ticker === ticker && stripExists) return;

    void refreshLiveData(result, ticker);
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-result]").forEach((result) => {
      const observer = new MutationObserver(() => inspectResult(result));
      observer.observe(result, { childList: true, subtree: true });
      inspectResult(result);
    });
  });
})();
