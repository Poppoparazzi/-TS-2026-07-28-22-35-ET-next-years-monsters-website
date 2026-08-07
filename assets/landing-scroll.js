// TS: 2026-08-07 18:22 ET

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
    hero.style.setProperty('transform', 'translate(-6%, -6%) scale(1.06) rotate(6deg)', 'important');
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

document.addEventListener("DOMContentLoaded", () => {
  restoreLandingAnchor();
  addHomepageGoldDust();
  tuneHomepageHero();
});
window.addEventListener("hashchange", restoreLandingAnchor);
