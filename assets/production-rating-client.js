// TS: 2026-08-10 17:05 ET

(() => {
  "use strict";

  const cache = new Map();

  function normalizeSymbol(value) {
    const symbol = String(value ?? "").trim().toUpperCase().replace(/^\$/, "");
    return /^[A-Z0-9.-]{1,15}$/.test(symbol) ? symbol : "";
  }

  function apiBase() {
    return String(window.NYM_CONFIG?.apiBaseUrl ?? "").replace(/\/$/, "");
  }

  function isProductionRating(value, expectedSymbol) {
    if (!value || typeof value !== "object") return false;

    const symbol = normalizeSymbol(value.symbol);
    if (!symbol || symbol !== expectedSymbol) return false;
    if (typeof value.engineVersion !== "string" || !value.engineVersion.trim()) return false;
    if (typeof value.calculatedAt !== "string" || !value.calculatedAt.trim()) return false;
    if (typeof value.eligible !== "boolean") return false;

    if (value.eligible) {
      const score = Number(value.score);
      return Number.isFinite(score) && score >= 0 && score <= 100;
    }

    return value.score === null &&
      typeof value.eligibilityCode === "string" &&
      Boolean(value.eligibilityCode.trim());
  }

  async function fetchRating(symbolValue) {
    const symbol = normalizeSymbol(symbolValue);
    if (!symbol) return { status: "invalid", symbol, data: null };
    if (cache.has(symbol)) return cache.get(symbol);

    const pending = (async () => {
      const base = apiBase();
      if (!base) return { status: "unavailable", symbol, data: null };

      try {
        const response = await fetch(`${base}/api/ratings/${encodeURIComponent(symbol)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (response.status === 404) {
          return { status: "not_found", symbol, data: null };
        }
        if (!response.ok) {
          return { status: "unavailable", symbol, data: null };
        }

        const data = await response.json();
        if (!isProductionRating(data, symbol)) {
          return { status: "invalid_payload", symbol, data: null };
        }
        return { status: "ok", symbol, data };
      } catch (_error) {
        return { status: "unavailable", symbol, data: null };
      }
    })();

    cache.set(symbol, pending);
    pending.then((result) => {
      if (result?.status !== "ok" && cache.get(symbol) === pending) {
        cache.delete(symbol);
      }
    });
    return pending;
  }

  window.NYM_PRODUCTION_RATING = Object.freeze({ fetchRating, normalizeSymbol });
})();