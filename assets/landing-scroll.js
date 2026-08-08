// TS: 2026-08-08 09:20 ET

function restoreLandingAnchor() {
  if (!window.location.hash) return;

  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(id);
  if (!target) return;

  target.style.scrollMarginTop = "96px";
  let attempts = 0;

  const settleAndScroll = () => {
    attempts += 1;
    const dynamicResult = document.querySelector("[data-result]");
    const resultReady = !dynamicResult || dynamicResult.innerHTML.trim().length > 0;

    if (resultReady || attempts >= 90) {
      target.scrollIntoView({ block: "start" });
      return;
    }

    window.requestAnimationFrame(settleAndScroll);
  };

  window.requestAnimationFrame(settleAndScroll);
}

function injectMonsterHuntHomepageBoard() {
  if (document.getElementById("monster-hunt-board")) return;

  const hero = document.querySelector(".home-hero");
  const monsterCheck = document.querySelector(".home-check");
  if (!hero || !monsterCheck) return;

  const section = document.createElement("section");
  section.className = "home-market-tools";
  section.id = "monster-hunt-board";
  section.setAttribute("aria-labelledby", "monster-hunt-board-title");
  section.innerHTML = `
    <div class="home-market-tools-inner">
      <div class="home-market-tools-head">
        <h2 id="monster-hunt-board-title">THE MONSTER<br>HUNT™.</h2>
        <p>The four-tier research board is now active. The Top 15 are ranked by the current Monster Fingerprint™ evidence model, Rising Monsters™ are pushing for promotion, the Watchlist holds developing cases, and Dropped Cases™ will preserve the record when evidence weakens.</p>
      </div>
      <div class="home-market-tools-grid">
        <a class="home-market-tool-card home-market-tool-card-featured" href="top-monsters.html#top-15">
          <div><span>TIER 1 / RANKED</span><strong>TOP 15</strong><small>See the strongest current fingerprint matches, their provisional Monster Ratings™, why each made the cut, and what could prove us wrong.</small></div>
          <em>OPEN THE TOP 15 →</em>
        </a>
        <a class="home-market-tool-card" href="top-monsters.html#rising-monsters">
          <div><span>TIER 2 / CHALLENGERS</span><strong>RISING MONSTERS™</strong><small>Companies close to breaking into the Top 15, with the exact evidence still needed to earn a promotion.</small></div>
          <em>SEE WHO IS RISING →</em>
        </a>
        <a class="home-market-tool-card" href="top-monsters.html#monster-watchlist">
          <div><span>TIER 3 / DEVELOPING</span><strong>MONSTER WATCHLIST™</strong><small>Promising but incomplete, mixed, or deteriorating cases that remain under active investigation.</small></div>
          <em>OPEN THE WATCHLIST →</em>
        </a>
        <a class="home-market-tool-card" href="top-monsters.html#dropped-cases">
          <div><span>TIER 4 / ACCOUNTABILITY</span><strong>DROPPED CASES™</strong><small>Once the inaugural snapshot is locked, companies that lose enough evidence will move here with the old score, new score, date, and reason.</small></div>
          <em>SEE THE RECORD →</em>
        </a>
      </div>
    </div>`;

  monsterCheck.parentNode.insertBefore(section, monsterCheck);
}

document.addEventListener("DOMContentLoaded", () => {
  injectMonsterHuntHomepageBoard();
  restoreLandingAnchor();
});
window.addEventListener("hashchange", restoreLandingAnchor);
