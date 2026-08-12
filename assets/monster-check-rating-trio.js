// TS: 2026-08-12 14:02 UTC

(function installMonsterCheckRatingTrio() {
  "use strict";

  const VCL_ESTABLISHED = new Set([
    "AAPL","NVDA","MNST","AMZN","TSLA","NFLX","AMD","COST","VRT","AXON","DECK","WING","META","APP","MSFT"
  ]);

  let board = null;

  function safe(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeTicker(value) {
    return String(value ?? "")
      .toUpperCase()
      .replace(/^\$/,"" )
      .replace(/[^A-Z0-9.-]/g, "");
  }

  async function loadBoard() {
    if (board) return board;
    try {
      const response = await fetch("data/monster-tier-board-preview.json", { cache: "no-store" });
      if (!response.ok) throw new Error("board unavailable");
      board = await response.json();
    } catch (_error) {
      board = { top15: [], rising: [], watchlist: [], dropped: [] };
    }
    return board;
  }

  function findBoardEntry(data, ticker) {
    const groups = [
      ["top15", "TOP 15"],
      ["rising", "RISING MONSTER™"],
      ["watchlist", "MONSTER WATCHLIST™"],
      ["dropped", "DROPPED CASE™"],
    ];
    for (const [key, label] of groups) {
      const items = Array.isArray(data[key]) ? data[key] : [];
      const index = items.findIndex(item => normalizeTicker(item.ticker) === ticker);
      if (index >= 0) return { item: items[index], tier: key, label, rank: key === "top15" ? index + 1 : null };
    }
    return null;
  }

  function extractTicker(result) {
    const candidates = [
      result.querySelector(".monster-launch-summary h2 span"),
      result.querySelector(".monster-result-identity h2 span"),
      result.querySelector("h2 span")
    ];
    for (const node of candidates) {
      const ticker = normalizeTicker(node?.textContent);
      if (ticker) return ticker;
    }
    const match = result.textContent.match(/\$([A-Z]{1,6}(?:[.-][A-Z0-9]{1,3})?)/i);
    return normalizeTicker(match?.[1]);
  }

  function replaceText(node, next) {
    if (node && node.textContent !== next) node.textContent = next;
  }

  function reframeLegacyResult(result, ticker, established, found) {
    const identity = result.querySelector(".monster-result-identity");
    const flag = identity?.querySelector(".monster-demo-flag") || result.querySelector(".monster-demo-flag");
    const sector = identity?.querySelector(".monster-result-sector");
    const scoreCard = result.querySelector(".monster-score-card");
    const scoreLabel = scoreCard?.querySelector("span");
    const scoreTier = scoreCard?.querySelector("em");

    if (flag?.textContent.includes("DEMONSTRATION RATING")) {
      replaceText(flag, "HISTORICAL VCL™ CASE STUDY · NOT A CURRENT STOCK RATING");
      if (sector?.textContent.includes("15-STOCK VISUAL CASE LIBRARY DEMO")) {
        sector.textContent = sector.textContent.replace("15-STOCK VISUAL CASE LIBRARY DEMO", "HISTORICAL VISUAL CASE LIBRARY™ STUDY");
      }
      replaceText(scoreLabel, "HISTORICAL CASE STUDY SCORE");
      if (scoreCard) scoreCard.setAttribute("aria-label", `Historical VCL case-study score for ${ticker}; not a current stock rating`);
      if (scoreTier && established) scoreTier.textContent = `${scoreTier.textContent} · HISTORICAL`;

      const evidenceHeading = result.querySelector(".monster-result-panel h3");
      replaceText(evidenceHeading, "WHY THIS HISTORICAL CASE SCORED THERE");

      const newsLabel = result.querySelector(".monster-news-copy .monster-section-label");
      replaceText(newsLabel, "04 / HISTORICAL CASE CONTEXT");

      const triggerHeadings = result.querySelectorAll(".monster-trigger h3");
      replaceText(triggerHeadings[0], "WHAT WOULD HAVE STRENGTHENED THE HISTORICAL CASE");
      replaceText(triggerHeadings[1], "WHAT WOULD HAVE WEAKENED THE HISTORICAL CASE");
      replaceText(triggerHeadings[2], "WHAT THE CASE TEACHES US TO WATCH");
    }

    if (flag?.textContent.includes("OFFICIAL SEC COMPANY RECORD")) {
      replaceText(scoreLabel, "CURRENT STOCK RATING™");
      if (scoreCard) scoreCard.setAttribute("aria-label", `Current Stock Rating not yet rated for ${ticker}`);
    }

    if (found && flag?.textContent.includes("NO SEC COMPANY MATCH FOUND")) {
      replaceText(flag, "MONSTER HUNT CASE · SEC PROFILE NOT CURRENTLY RETURNED");
      const emptyCopy = result.querySelector(".monster-empty-state > p:not(.monster-demo-flag)");
      replaceText(
        emptyCopy,
        "This ticker is on the published Monster Hunt research board, but the official SEC company profile did not return from the current service lookup. The Hunt score remains research-board evidence, not a Current Stock Rating™."
      );
    }

    if (found && flag?.textContent.includes("HISTORICAL VCL")) {
      const note = document.createElement("p");
      note.className = "monster-rating-trio-note";
      note.textContent = "This ticker is also an active Monster Hunt case. The historical VCL score below remains a case-study artifact; the live Future Monster Fingerprint Rating is shown in the three-answer panel above.";
      const content = result.querySelector(":scope > .monster-investigator-result-content") || result;
      if (!content.querySelector("[data-active-hunt-vcl-note]")) {
        note.dataset.activeHuntVclNote = "true";
        const trio = content.querySelector(":scope > .monster-rating-trio");
        trio?.insertAdjacentElement("afterend", note);
      }
    }
  }

  function recoverSearchControls(result) {
    const button = document.querySelector("[data-rate-button]");
    if (!button || !button.disabled) return;

    const flag = result.querySelector(".monster-demo-flag");
    const stillLoading = flag?.textContent.includes("CHECKING OFFICIAL SEC RECORDS");
    if (stillLoading) return;

    button.disabled = false;
    button.textContent = "RUN THE CHECK";
  }

  function injectStyles() {
    if (document.getElementById("monster-rating-trio-styles")) return;
    const style = document.createElement("style");
    style.id = "monster-rating-trio-styles";
    style.textContent = `
      .monster-rating-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 24px;padding:0}
      .monster-case-loaded-banner{grid-column:1/-1;margin:0;padding:13px 16px;border-left:5px solid #a8df34;background:#eaf6d2;color:#17200f;font-size:11px;font-weight:950;letter-spacing:.035em;line-height:1.45}
      .monster-rating-trio-card{min-height:158px;padding:18px;border:1px solid rgba(255,255,255,.18);background:#111715;color:#fffaf0}
      .monster-rating-trio-card:nth-child(1){border-top:5px solid #d9aa31}.monster-rating-trio-card:nth-child(2){border-top:5px solid #a8df34}.monster-rating-trio-card:nth-child(3){border-top:5px solid #e64545}
      .monster-rating-trio-card span{display:block;margin-bottom:9px;color:#aeb6af;font-size:9px;font-weight:950;letter-spacing:.06em}
      .monster-rating-trio-card strong{display:block;margin-bottom:7px;color:#fffaf0;font-size:clamp(22px,2.5vw,34px);line-height:1}
      .monster-rating-trio-card em{display:block;margin-bottom:10px;color:#b8f34a;font-size:11px;font-style:normal;font-weight:950;letter-spacing:.035em}
      .monster-rating-trio-card p{margin:0;color:#cfd5cf;font-size:12px;line-height:1.45}
      .monster-rating-trio-note{grid-column:1/-1;margin:0;padding:11px 14px;border-left:4px solid #d9aa31;background:#fff3cf;color:#26302b;font-size:12px;font-weight:650;line-height:1.45}
      .monster-rating-trio-note strong{color:#111715;font-weight:950}
      @media(max-width:850px){.monster-rating-trio{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  async function decorateResult() {
    const result = document.querySelector("[data-result]");
    if (!result || !result.firstElementChild || getComputedStyle(result).display === "none") return;

    const ticker = extractTicker(result);
    if (!ticker) return;

    const data = await loadBoard();
    if (extractTicker(result) !== ticker) return;

    const content = result.querySelector(":scope > .monster-investigator-result-content") || result;
    const found = findBoardEntry(data, ticker);
    const established = VCL_ESTABLISHED.has(ticker) && !found;
    const historicalScore = established
      ? String(result.querySelector(".monster-score-card strong")?.textContent ?? "").trim()
      : "";

    let trio = content.querySelector(":scope > .monster-rating-trio");
    if (!trio) {
      let futureValue = "—";
      let futureStatus = "NOT YET EVALUATED";
      let huntValue = "NOT YET EVALUATED";
      let huntDetail = "This ticker is not currently on the published Monster Hunt board.";
      let loadedBanner = `${ticker} COMPANY RECORD LOADED · CURRENT LIVE RATING REMAINS PENDING`;
      let currentValue = "LIVE RATING PENDING";
      let currentStatus = "CURRENT STOCK RATING™";
      let currentDetail = "Official company evidence can load now, but a current numeric rating waits for the licensed market feed and complete versioned calculation.";

      if (found) {
        futureValue = safe(found.item.score_status ?? found.item.score ?? "SCORING");
        futureStatus = "FINGERPRINT SCORE";
        huntValue = found.rank ? `#${found.rank} TOP 15` : found.label;
        huntDetail = found.item.status ? safe(found.item.status) : "Active Monster Hunt case.";
        loadedBanner = `${ticker} MONSTER HUNT RESEARCH DATA LOADED · CURRENT LIVE RATING REMAINS PENDING`;
      } else if (established) {
        futureValue = historicalScore ? `${safe(historicalScore)} HISTORICAL` : "CASE LOADED";
        futureStatus = "VCL™ CASE-STUDY SCORE";
        huntValue = "ESTABLISHED LEADER";
        huntDetail = "The selected company’s historical evidence, risks, Monster DNA™, and lessons are loaded directly below these status cards.";
        loadedBanner = `${ticker} HISTORICAL VCL™ CASE DATA LOADED · CURRENT LIVE RATING REMAINS PENDING`;
        currentValue = "CASE DATA LOADED";
        currentStatus = "CURRENT LIVE RATING PENDING";
        currentDetail = "This selection is working: it loaded the company-specific historical VCL™ evidence below without substituting the old case score for a current rating.";
      }

      trio = document.createElement("section");
      trio.className = "monster-rating-trio";
      trio.setAttribute("aria-label", `Current stock, Future Monster fingerprint, and Monster Hunt status for ${ticker}`);
      trio.innerHTML = `
        <p class="monster-case-loaded-banner">✓ ${loadedBanner}</p>
        <article class="monster-rating-trio-card">
          <span>01 / THEIR STOCK</span>
          <strong>${currentValue}</strong>
          <em>${currentStatus}</em>
          <p>${currentDetail}</p>
        </article>
        <article class="monster-rating-trio-card">
          <span>02 / FUTURE MONSTER</span>
          <strong>${futureValue}</strong>
          <em>${futureStatus}</em>
          <p>${found ? "Research-board score measuring similarity to historical pre-breakout Monster fingerprints. It is not the same as a current-stock quality rating." : established ? "This mature VCL™ leader is a historical comparison case, so an emerging-Monster fingerprint score is not assigned here." : "No published Future Monster fingerprint score is assigned to this ticker yet."}</p>
        </article>
        <article class="monster-rating-trio-card">
          <span>03 / THE HUNT</span>
          <strong>${huntValue}</strong>
          <em>MONSTER HUNT STATUS</em>
          <p>${huntDetail}</p>
        </article>
        <p class="monster-rating-trio-note"><strong>Three different questions:</strong> how the stock rates today, whether it resembles a pre-breakout historical Monster, and where it sits in the active Hunt. Missing evidence stays missing rather than becoming a decorative number.</p>
      `;
      content.prepend(trio);
    }

    reframeLegacyResult(result, ticker, established, found);
  }

  function start() {
    injectStyles();
    const result = document.querySelector("[data-result]");
    if (!result) return;
    let frame = 0;
    const rerun = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        recoverSearchControls(result);
        void decorateResult();
      });
    };
    new MutationObserver(rerun).observe(result, { childList: true, subtree: true });
    rerun();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
