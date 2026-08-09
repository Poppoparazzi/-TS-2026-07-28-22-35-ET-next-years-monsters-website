// TS: 2026-08-09 08:08 ET

function setupRequestedTicker() {
  const requested = new URLSearchParams(window.location.search).get("ticker")?.trim().toUpperCase();
  if (!requested) return;

  const tickerPattern = /^[A-Z0-9.-]{1,15}$/;
  if (!tickerPattern.test(requested)) return;

  let attempts = 0;
  let clickAttempts = 0;
  const maxAttempts = 160;

  const resultShowsRequestedTicker = (result) => {
    if (!result || getComputedStyle(result).display === "none") return false;
    const text = result.textContent.toUpperCase();
    return text.includes(`$${requested}`) || text.includes(requested);
  };

  const timer = window.setInterval(() => {
    attempts += 1;

    const input = document.querySelector("[data-ticker-input]");
    const button = document.querySelector("[data-rate-button]");
    const result = document.querySelector("[data-result]");

    if (resultShowsRequestedTicker(result)) {
      window.clearInterval(timer);
      window.setTimeout(() => result.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
      return;
    }

    if (input && button && result && !button.disabled) {
      input.value = requested;
      button.click();
      clickAttempts += 1;
    }

    if (attempts >= maxAttempts || clickAttempts >= 20) {
      window.clearInterval(timer);
    }
  }, 75);
}

document.addEventListener("DOMContentLoaded", setupRequestedTicker);
