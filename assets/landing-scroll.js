// TS: 2026-08-12 13:46 UTC

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

function tuneHomepageHero() {
  const hero = document.querySelector('.home-page .home-hero-art img[data-captain-image].home-bull-rider-hero');
  if (!hero) return;

  hero.src = '/cb%20with%20background%20removed.png';
  hero.style.setProperty('z-index', '4', 'important');
  hero.style.setProperty('opacity', '1', 'important');
  hero.style.setProperty('visibility', 'visible', 'important');
  hero.style.setProperty('display', 'block', 'important');

  if (window.innerWidth >= 1051) {
    const shortDesktopViewport = window.innerHeight <= 780;
    const transform = shortDesktopViewport
      ? 'scale(.98)'
      : 'translate(-4%, 0)';
    hero.style.setProperty('transform', transform, 'important');
  }
}

function addHomepageGoldDust() {
  const art = document.querySelector('.home-page .home-hero-art');
  if (!art || document.getElementById('homepage-gold-dust-layer')) return;

  const dust = document.createElement('div');
  dust.id = 'homepage-gold-dust-layer';
  dust.setAttribute('aria-hidden', 'true');
  dust.style.cssText = [
    'position:absolute',
    'top:0',
    'right:0',
    'bottom:0',
    'left:38%',
    'z-index:1',
    'pointer-events:none',
    'opacity:.78',
    'background:radial-gradient(ellipse at 92% 88%, rgba(255,198,72,.52) 0%, rgba(206,137,35,.36) 22%, rgba(129,78,20,.18) 44%, transparent 68%), radial-gradient(ellipse at 73% 73%, rgba(255,214,105,.34) 0%, rgba(197,128,28,.24) 26%, transparent 58%), radial-gradient(ellipse at 86% 48%, rgba(241,185,62,.22) 0%, rgba(159,100,22,.12) 30%, transparent 56%), radial-gradient(circle at 15% 30%, rgba(255,218,124,.48) 0 1.1px, transparent 1.7px) 0 0 / 31px 31px, radial-gradient(circle at 64% 58%, rgba(244,173,53,.38) 0 1.3px, transparent 1.9px) 7px 13px / 43px 43px, radial-gradient(circle at 86% 78%, rgba(255,224,139,.34) 0 1px, transparent 1.6px) 15px 5px / 25px 25px'
  ].join(';');

  const hero = art.querySelector('img[data-captain-image].home-bull-rider-hero');
  if (hero) {
    art.insertBefore(dust, hero);
  } else {
    art.appendChild(dust);
  }
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
  restoreLandingAnchor();
  addHomepageGoldDust();
  tuneHomepageHero();
  injectMonsterHuntHomepageBoard();
});
window.addEventListener("hashchange", restoreLandingAnchor);
