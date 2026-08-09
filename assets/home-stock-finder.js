// TS: 2026-08-09 08:10 ET

function installHomeCheckDetective() {
  const heading = document.querySelector(".home-check-heading");
  if (!heading) return;

  // The direct HTML fallback may still contain the older Captain Breakout block.
  // Remove that stale mascot before installing the current approved Detective Break artwork.
  heading.querySelectorAll(".home-check-captain-direct").forEach((node) => node.remove());
  if (heading.querySelector(".home-check-detective")) return;

  const style = document.createElement("style");
  style.id = "home-check-detective-styles";
  style.textContent = `
    .home-check-heading{position:relative;overflow:hidden}
    .home-check-detective{margin:20px 0 0;display:flex;align-items:flex-end;justify-content:center;min-height:690px}
    .home-check-detective img{display:block;width:min(470px,100%);height:690px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 24px 36px rgba(0,0,0,.52))}
    @media(max-width:1050px){.home-check-detective{min-height:500px}.home-check-detective img{width:min(360px,86%);height:500px}}
    @media(max-width:650px){.home-check-detective{margin-top:18px;min-height:390px}.home-check-detective img{width:min(290px,82%);height:390px}}
  `;
  document.head.appendChild(style);

  const figure = document.createElement("figure");
  figure.className = "home-check-detective";
  figure.setAttribute("aria-label", "Detective Break investigating the Monster Check evidence");
  figure.innerHTML = `
    <img src="assets/detective-break-actual.svg" alt="Detective Break, the tall green financial investigator, examining stock evidence">
  `;
  heading.appendChild(figure);
}

function restoreHomeMonsterCheckData() {
  const result = document.querySelector(".home-result-card[data-result]");
  const suggestions = document.querySelector(".home-suggestions[data-suggestions]");
  if (!result || !suggestions) return;

  const hasVisibleResult = () =>
    result.style.display !== "none" && result.innerHTML.trim().length > 0;

  const clickNvdaIfReady = () => {
    if (hasVisibleResult()) return true;

    const nvda = Array.from(suggestions.querySelectorAll(".chip"))
      .find((chip) => chip.textContent.trim().toUpperCase() === "NVDA");
    if (!nvda) return false;

    // Do not mark restoration complete just because the click fired.
    // app.js can still clear the result later in the same setup cycle.
    // Keep checking until the NVIDIA card is actually visible and populated.
    nvda.click();
    return false;
  };

  const observer = new MutationObserver(() => {
    clickNvdaIfReady();
  });
  observer.observe(suggestions, { childList: true, subtree: true });

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;

    if (hasVisibleResult()) {
      window.clearInterval(timer);
      observer.disconnect();
      return;
    }

    clickNvdaIfReady();

    if (attempts >= 100) {
      window.clearInterval(timer);
      observer.disconnect();
    }
  }, 100);
}

function startHomeStockFinder() {
  installHomeCheckDetective();
  restoreHomeMonsterCheckData();

  const form = document.querySelector("[data-home-stock-finder]");
  const input = document.querySelector("[data-home-stock-finder-input]");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = input.value.trim();
    const exactTicker = query.toUpperCase();
    const isExactTicker = /^[A-Z0-9.-]{1,15}$/.test(query) && !query.includes(" ");
    const url = new URL(
      isExactTicker ? "market-explorer.html" : "coverage-universe.html",
      window.location.href,
    );
    if (isExactTicker) {
      url.searchParams.set("left", exactTicker);
      url.searchParams.set("mode", "single");
    } else if (query) {
      url.searchParams.set("q", query);
    }
    window.location.href = url.toString();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startHomeStockFinder);
} else {
  startHomeStockFinder();
}
