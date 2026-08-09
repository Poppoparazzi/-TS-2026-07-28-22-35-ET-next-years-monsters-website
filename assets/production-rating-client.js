// TS: 2026-08-09 10:02 ET

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

  function isProductionRating(value) {
    if (!value || typeof value !== "object") return false;
    if (typeof value.symbol !== "string") return false;
    if (typeof value.engineVersion !== "string" || !value.engineVersion.trim()) return false;
    if (typeof value.calculatedAt !== "string" || !value.calculatedAt.trim()) return false;
    if (typeof value.eligible !== "boolean") return false;
    if (value.eligible) return Number.isFinite(Number(value.score));
    return value.score === null && typeof value.eligibilityCode === "string";
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
        if (!isProductionRating(data)) {
          return { status: "invalid_payload", symbol, data: null };
        }
        return { status: "ok", symbol, data };
      } catch (_error) {
        return { status: "unavailable", symbol, data: null };
      }
    })();

    cache.set(symbol, pending);
    return pending;
  }

  window.NYM_PRODUCTION_RATING = Object.freeze({ fetchRating, normalizeSymbol });
})();
