// TS: 2026-08-09 09:11 ET

(() => {
  "use strict";

  const REQUIRED_INPUTS = [
    { key: "identity", label: "Official SEC company identity" },
    { key: "filing", label: "Latest official SEC filing" },
    { key: "quote", label: "Current market quote" },
    { key: "freshness", label: "Quote freshness / provider timestamp" },
    { key: "financials", label: "Verified current financial evidence" },
    { key: "risk", label: "Verified current risk evidence" },
    { key: "calculation", label: "Versioned Current Stock Rating™ calculation" },
  ];

  function text(node) {
    return String(node?.textContent ?? "").trim();
  }

  function isUnavailable(value) {
    const normalized = String(value ?? "").trim().toUpperCase();
    return !normalized || [
      "CONNECTING…",
      "CONNECTING...",
      "UNAVAILABLE",
      "NOT CONNECTED",
      "MARKET DATA NOT CONNECTED",
      "CHECKING PROVIDER…",
      "CHECKING PROVIDER...",
      "CHECKING EDGAR…",
      "CHECKING EDGAR...",
      "SEC CONNECTION UNAVAILABLE",
      "NO RECENT FILING RETURNED",
    ].some((token) => normalized.includes(token));
  }

  function inspect(result) {
    const flag = text(result.querySelector(".monster-demo-flag"));
    const officialIdentity = flag.includes("OFFICIAL SEC COMPANY RECORD");

    const filingForm = text(result.querySelector("[data-live-filing-form]"));
    const filingLink = result.querySelector("[data-live-filing-link][href]");
    const filing = Boolean(filingLink) && !isUnavailable(filingForm);

    const quoteText = text(result.querySelector("[data-live-price]"));
    const quote = !isUnavailable(quoteText) && /\d/.test(quoteText);

    const freshnessText = text(result.querySelector("[data-live-freshness]"));
    const timeText = text(result.querySelector("[data-live-time]"));
    const freshness = quote && !isUnavailable(freshnessText) && !isUnavailable(timeText);

    return {
      identity: officialIdentity,
      filing,
      quote,
      freshness,
      // These stay false until production exposes explicit machine-readable proof.
      // A plausible-looking page is not enough evidence to publish a score.
      financials: false,
      risk: false,
      calculation: false,
    };
  }

  function injectStyles() {
    if (document.getElementById("current-stock-readiness-styles")) return;
    const style = document.createElement("style");
    style.id = "current-stock-readiness-styles";
    style.textContent = `
      .current-stock-readiness{margin:0 0 24px;padding:20px;border:1px solid rgba(255,255,255,.18);background:#0d1210;color:#fffaf0}
      .current-stock-readiness-head{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;justify-content:space-between;margin-bottom:16px}
      .current-stock-readiness-kicker{display:block;margin-bottom:7px;color:#aeb6af;font-size:9px;font-weight:950;letter-spacing:.07em}
      .current-stock-readiness h3{margin:0;color:#fffaf0;font-size:clamp(22px,2.5vw,34px);line-height:1}
      .current-stock-readiness-summary{display:block;padding:8px 11px;border:1px solid rgba(217,170,49,.55);color:#f0c95a;font-size:10px;font-weight:950;letter-spacing:.045em}
      .current-stock-readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
      .current-stock-readiness-grid li{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;background:#151b18;color:#d6dbd5;font-size:11px;line-height:1.35}
      .current-stock-readiness-grid b{flex:0 0 auto;width:18px;height:18px;border-radius:50%;display:grid;place-items:center;font-size:10px}
      .current-stock-readiness-grid .is-ready b{background:#b8f34a;color:#0a0e0c}
      .current-stock-readiness-grid .is-missing b{background:#342520;color:#f0c95a}
      .current-stock-readiness-note{margin:14px 0 0;color:#aeb6af;font-size:11px;line-height:1.5}
      @media(max-width:720px){.current-stock-readiness-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function render(result) {
    if (!result?.firstElementChild || getComputedStyle(result).display === "none") return;

    const tickerNode = result.querySelector(".monster-result-identity h2 span, .monster-launch-summary h2 span");
    const ticker = text(tickerNode).replace(/^\$/,"" );
    if (!ticker) return;

    const state = inspect(result);
    const completeCount = REQUIRED_INPUTS.filter((item) => state[item.key]).length;
    const ready = completeCount === REQUIRED_INPUTS.length;
    const signature = `${ticker}|${REQUIRED_INPUTS.map((item) => state[item.key] ? "1" : "0").join("")}`;

    let panel = result.querySelector(":scope .current-stock-readiness");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "current-stock-readiness";
      const trio = result.querySelector(".monster-rating-trio");
      if (trio) trio.insertAdjacentElement("afterend", panel);
      else result.prepend(panel);
    }

    if (panel.dataset.readinessSignature === signature) return;
    panel.dataset.readinessSignature = signature;
    panel.setAttribute("aria-label", `Current Stock Rating readiness for ${ticker}`);
    panel.innerHTML = `
      <div class="current-stock-readiness-head">
        <div>
          <span class="current-stock-readiness-kicker">CURRENT STOCK RATING™ / REQUIRED EVIDENCE</span>
          <h3>${ready ? "READY TO CALCULATE" : "DATA INCOMPLETE / NOT YET RATED"}</h3>
        </div>
        <strong class="current-stock-readiness-summary">${completeCount} / ${REQUIRED_INPUTS.length} VERIFIED INPUTS PRESENT</strong>
      </div>
      <ul class="current-stock-readiness-grid">
        ${REQUIRED_INPUTS.map((item) => {
          const present = Boolean(state[item.key]);
          return `<li class="${present ? "is-ready" : "is-missing"}"><b>${present ? "✓" : "!"}</b><span>${item.label}<br><small>${present ? "VERIFIED IN THIS RESULT" : "REQUIRED BEFORE A CURRENT SCORE CAN BE PUBLISHED"}</small></span></li>`;
        }).join("")}
      </ul>
      <p class="current-stock-readiness-note">This checklist is intentionally strict. SEC identity, a filing, or a quote can be present without creating a Current Stock Rating™. Financial evidence, risk evidence, quote freshness, and the versioned calculation must all be explicitly verified before a score is allowed to appear.</p>
    `;
  }

  function start() {
    if (!/\/monster-check\.html$/i.test(window.location.pathname)) return;
    injectStyles();

    const result = document.querySelector("[data-result]");
    if (!result) return;

    let frame = 0;
    const rerender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => render(result));
    };

    new MutationObserver(rerender).observe(result, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["href", "data-live-status"],
    });

    rerender();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
