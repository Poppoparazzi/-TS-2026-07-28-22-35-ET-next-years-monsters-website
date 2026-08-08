// TS: 2026-08-08 19:08 ET

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

  function injectStyles() {
    if (document.getElementById("monster-rating-trio-styles")) return;
    const style = document.createElement("style");
    style.id = "monster-rating-trio-styles";
    style.textContent = `
      .monster-rating-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 24px;padding:0}
      .monster-rating-trio-card{min-height:158px;padding:18px;border:1px solid rgba(255,255,255,.18);background:#111715;color:#fffaf0}
      .monster-rating-trio-card:nth-child(1){border-top:5px solid #d9aa31}.monster-rating-trio-card:nth-child(2){border-top:5px solid #a8df34}.monster-rating-trio-card:nth-child(3){border-top:5px solid #e64545}
      .monster-rating-trio-card span{display:block;margin-bottom:9px;color:#aeb6af;font-size:9px;font-weight:950;letter-spacing:.06em}
      .monster-rating-trio-card strong{display:block;margin-bottom:7px;color:#fffaf0;font-size:clamp(22px,2.5vw,34px);line-height:1}
      .monster-rating-trio-card em{display:block;margin-bottom:10px;color:#b8f34a;font-size:11px;font-style:normal;font-weight:950;letter-spacing:.035em}
      .monster-rating-trio-card p{margin:0;color:#cfd5cf;font-size:12px;line-height:1.45}
      .monster-rating-trio-note{grid-column:1/-1;margin:0;padding:11px 14px;border-left:4px solid #d9aa31;background:rgba(217,170,49,.08);color:#d6dbd5;font-size:11px;line-height:1.45}
      @media(max-width:850px){.monster-rating-trio{grid-template-columns:1fr}}
    `;
    document.head.append(style);
  }

  async function decorateResult() {
    const result = document.querySelector("[data-result]");
    if (!result || !result.firstElementChild || getComputedStyle(result).display === "none") return;

    const content = result.querySelector(":scope > .monster-investigator-result-content") || result;
    if (content.querySelector(":scope > .monster-rating-trio")) return;

    const ticker = extractTicker(result);
    if (!ticker) return;

    const data = await loadBoard();
    const found = findBoardEntry(data, ticker);
    const established = VCL_ESTABLISHED.has(ticker) && !found;

    let futureValue = "—";
    let futureStatus = "NOT YET EVALUATED";
    let huntValue = "NOT YET EVALUATED";
    let huntDetail = "This ticker is not currently on the published Monster Hunt board.";

    if (found) {
      futureValue = safe(found.item.score_status ?? found.item.score ?? "SCORING");
      futureStatus = "FINGERPRINT SCORE";
      huntValue = found.rank ? `#${found.rank} TOP 15` : found.label;
      huntDetail = found.item.status ? safe(found.item.status) : "Active Monster Hunt case.";
    } else if (established) {
      futureValue = "N/A";
      futureStatus = "ESTABLISHED LEADER";
      huntValue = "NOT A NEW-MONSTER CANDIDATE";
      huntDetail = "Historical VCL™ leader. Studied for fingerprints, not ranked as an emerging Monster merely because it became a great company.";
    }

    const trio = document.createElement("section");
    trio.className = "monster-rating-trio";
    trio.setAttribute("aria-label", `Current stock, Future Monster fingerprint, and Monster Hunt status for ${ticker}`);
    trio.innerHTML = `
      <article class="monster-rating-trio-card">
        <span>01 / THEIR STOCK</span>
        <strong>DATA INCOMPLETE</strong>
        <em>CURRENT STOCK RATING™ · NOT YET RATED</em>
        <p>No current score is manufactured until the required verified business, financial, market, risk, and freshness inputs are complete.</p>
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

  function start() {
    injectStyles();
    const result = document.querySelector("[data-result]");
    if (!result) return;
    let frame = 0;
    const rerun = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(decorateResult);
    };
    new MutationObserver(rerun).observe(result, { childList: true, subtree: true });
    rerun();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
