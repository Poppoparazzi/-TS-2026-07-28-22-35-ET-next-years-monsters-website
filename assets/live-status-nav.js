// TS: 2026-08-13 15:09 ET

(function alignLiveStatusNavigation() {
  function apply() {
    if (!document.body?.classList.contains("live-status-page")) return;

    const nav = document.querySelector(".home-nav-links");
    if (nav) {
      const links = [
        ["START HERE", "start-here.html"],
        ["MONSTER CHECK", "monster-check.html"],
        ["MONSTER HUNT", "top-monsters.html"],
        ["THE SYSTEM", "how-it-works.html"],
        ["VCL™ LIBRARY", "vcl-library.html"],
        ["ABOUT", "about.html"],
      ];
      nav.replaceChildren(...links.map(([label, href]) => {
        const link = document.createElement("a");
        link.href = href;
        link.textContent = label;
        return link;
      }));
    }

    const cta = document.querySelector(".home-nav-cta");
    if (cta) {
      cta.href = "monster-check.html";
      cta.textContent = "RUN MONSTER CHECK™";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply, { once: true });
  } else {
    apply();
  }
})();
