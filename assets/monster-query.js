// TS: 2026-08-15 09:40 ET

function setupRequestedTicker() {
  const requested = new URLSearchParams(window.location.search).get("ticker")?.trim().toUpperCase();
  if (!requested) return;

  const tickerPattern = /^[A-Z0-9.-]{1,15}$/;
  if (!tickerPattern.test(requested)) return;

  document.body.classList.add("direct-ticker-request");

  if (!document.getElementById("direct-ticker-result-styles")) {
    const style = document.createElement("style");
    style.id = "direct-ticker-result-styles";
    style.textContent = `
      .direct-ticker-request .monster-result.monster-investigator-result {
        display: block !important;
        grid-template-columns: 1fr !important;
      }
      .direct-ticker-request .monster-investigator-result-art {
        display: none !important;
      }
      .direct-ticker-request .monster-investigator-result-content {
        padding: 0 !important;
      }
      .direct-ticker-request .current-stock-readiness {
        margin-top: 28px !important;
      }
    `;
    document.head.appendChild(style);
  }

  let attempts = 0;
  let clickAttempts = 0;
  const maxAttempts = 160;

  const resultShowsRequestedTicker = (result) => {
    if (!result || getComputedStyle(result).display === "none") return false;
    const text = result.textContent.toUpperCase();
    return text.includes(`$${requested}`) || text.includes(requested);
  };

  const prioritizeRequestedStock = (result) => {
    if (!result) return null;

    const content = result.querySelector(".monster-investigator-result-content") || result;
    const readiness = content.querySelector(".current-stock-readiness");
    if (readiness) content.appendChild(readiness);

    return (
      content.querySelector(".monster-launch-score-first") ||
      content.querySelector(".monster-result-head") ||
      content.querySelector(".monster-launch-summary") ||
      content
    );
  };

  const timer = window.setInterval(() => {
    attempts += 1;

    const input = document.querySelector("[data-ticker-input]");
    const button = document.querySelector("[data-rate-button]");
    const result = document.querySelector("[data-result]");

    if (resultShowsRequestedTicker(result)) {
      window.clearInterval(timer);
      window.setTimeout(() => {
        const target = prioritizeRequestedStock(result);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 160);
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
