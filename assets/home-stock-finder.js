// TS: 2026-08-08 23:40 ET

function installHomeCheckCaptain() {
  const heading = document.querySelector(".home-check-heading");
  if (!heading || heading.querySelector(".home-check-captain")) return;

  const style = document.createElement("style");
  style.id = "home-check-captain-styles";
  style.textContent = `
    .home-check-heading{position:relative;overflow:hidden}
    .home-check-captain{margin:32px 0 0;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;min-height:360px}
    .home-check-captain img{display:block;width:min(315px,86%);max-height:410px;object-fit:contain;object-position:left bottom;filter:drop-shadow(0 20px 30px rgba(0,0,0,.48))}
    .home-check-captain figcaption{margin:8px 0 0;color:var(--editorial-lime);font-size:10px;font-weight:950;letter-spacing:.055em;line-height:1.45}
    @media(max-width:1050px){.home-check-captain{min-height:0;align-items:center}.home-check-captain img{width:min(260px,72%);object-position:center bottom}.home-check-captain figcaption{text-align:center}}
    @media(max-width:650px){.home-check-captain{margin-top:24px}.home-check-captain img{width:min(210px,70%)}.home-check-captain figcaption{font-size:9px}}
  `;
  document.head.appendChild(style);

  const figure = document.createElement("figure");
  figure.className = "home-check-captain";
  figure.setAttribute("aria-label", "Captain Breakout beside the Monster Check instructions");
  figure.innerHTML = `
    <img src="captain_breakout.png" alt="Captain Breakout beside the Monster Check evidence panel">
    <figcaption>CAPTAIN BREAKOUT™ · CHECK THE STOCK. READ THE EVIDENCE.</figcaption>
  `;
  heading.appendChild(figure);
}

function startHomeStockFinder() {
  installHomeCheckCaptain();

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
