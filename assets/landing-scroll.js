// TS: 2026-08-07 18:10 ET

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

function addHomepageGoldDust() {
  if (document.getElementById('homepage-gold-dust-live')) return;

  const style = document.createElement('style');
  style.id = 'homepage-gold-dust-live';
  style.textContent = `
    @media (min-width: 1051px) {
      .home-page .home-hero-art::before {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 36%;
        z-index: 1;
        pointer-events: none;
        opacity: .98;
        background:
          radial-gradient(ellipse at 88% 82%, rgba(255, 198, 72, .58) 0%, rgba(206, 137, 35, .46) 19%, rgba(129, 78, 20, .25) 41%, transparent 67%),
          radial-gradient(ellipse at 72% 68%, rgba(255, 214, 105, .46) 0%, rgba(197, 128, 28, .34) 24%, transparent 57%),
          radial-gradient(ellipse at 84% 43%, rgba(241, 185, 62, .31) 0%, rgba(159, 100, 22, .18) 28%, transparent 54%),
          radial-gradient(circle at 12% 28%, rgba(255, 218, 124, .62) 0 1.2px, transparent 1.8px) 0 0 / 29px 29px,
          radial-gradient(circle at 62% 56%, rgba(244, 173, 53, .48) 0 1.4px, transparent 2px) 8px 14px / 41px 41px,
          radial-gradient(circle at 84% 76%, rgba(255, 224, 139, .42) 0 1px, transparent 1.7px) 17px 5px / 23px 23px;
      }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", () => {
  restoreLandingAnchor();
  tuneHomepageHero();
  addHomepageGoldDust();
});
window.addEventListener("hashchange", restoreLandingAnchor);
