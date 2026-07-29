// TS: 2026-07-29 10:53 ET

function setupRequestedTicker() {
  const requested = new URLSearchParams(window.location.search).get("ticker")?.trim().toUpperCase();
  if (!requested) return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const input = document.querySelector("[data-ticker-input]");
    const button = document.querySelector("[data-rate-button]");
    const result = document.querySelector("[data-result]");

    const monsterCheckReady = input && button && result && result.innerHTML.trim().length > 0;
    if (monsterCheckReady) {
      input.value = requested;
      button.click();
      window.clearInterval(timer);
      window.setTimeout(() => result.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return;
    }

    if (attempts >= 120) window.clearInterval(timer);
  }, 50);
}

document.addEventListener("DOMContentLoaded", setupRequestedTicker);
