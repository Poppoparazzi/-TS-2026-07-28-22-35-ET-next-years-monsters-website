// TS: 2026-08-07 17:55 ET

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

  hero.src = 'cb with background removed.png';

  if (window.innerWidth >= 1051) {
    hero.style.setProperty('transform', 'translate(-6%, -6%) scale(1.06) rotate(6deg)', 'important');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  restoreLandingAnchor();
  tuneHomepageHero();
});
window.addEventListener("hashchange", restoreLandingAnchor);
