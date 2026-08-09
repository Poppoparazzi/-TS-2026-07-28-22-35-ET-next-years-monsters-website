// TS: 2026-08-08 23:48 ET

function installHomeCheckDetective() {
  const heading = document.querySelector(".home-check-heading");
  if (!heading || heading.querySelector(".home-check-detective")) return;

  const style = document.createElement("style");
  style.id = "home-check-detective-styles";
  style.textContent = `
    .home-check-heading{position:relative;overflow:hidden}
    .home-check-detective{margin:26px 0 0;display:flex;align-items:flex-end;justify-content:center;min-height:630px}
    .home-check-detective img{display:block;width:min(430px,96%);height:630px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 24px 36px rgba(0,0,0,.52))}
    @media(max-width:1050px){.home-check-detective{min-height:460px}.home-check-detective img{width:min(330px,82%);height:460px}}
    @media(max-width:650px){.home-check-detective{margin-top:20px;min-height:360px}.home-check-detective img{width:min(270px,78%);height:360px}}
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

function startHomeStockFinder() {
  installHomeCheckDetective();

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
