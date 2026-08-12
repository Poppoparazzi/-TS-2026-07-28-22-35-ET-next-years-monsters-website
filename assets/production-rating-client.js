// TS: 2026-08-12 15:01 ET

(() => {
  "use strict";

  // Runtime config and Monster Check can both request this client during a deploy transition.
  // Keep one live client/cache instance instead of resetting it when a duplicate script arrives.
  if (window.NYM_PRODUCTION_RATING?.fetchRating) return;

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 10000;
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

  function freshCachedRequest(symbol) {
    const entry = cache.get(symbol);
    if (!entry) return null;
    if (Date.now() - entry.createdAt < CACHE_TTL_MS) return entry.promise;
    cache.delete(symbol);
    return null;
  }

  async function fetchRating(symbolValue) {
    const symbol = normalizeSymbol(symbolValue);
    if (!symbol) return { status: "invalid", symbol, data: null };

    const cached = freshCachedRequest(symbol);
    if (cached) return cached;

    const pending = (async () => {
      const base = apiBase();
      if (!base) return { status: "unavailable", symbol, data: null };

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${base}/api/ratings/${encodeURIComponent(symbol)}`, {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
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
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    const entry = { createdAt: Date.now(), promise: pending };
    cache.set(symbol, entry);
    pending.then((result) => {
      // Keep successful responses and terminal negative results briefly cached.
      // Only transient availability failures should immediately reopen the network path.
      const keepCached = ["ok", "not_found", "invalid_payload"].includes(result?.status);
      if (!keepCached && cache.get(symbol) === entry) {
        cache.delete(symbol);
      }
    });
    return pending;
  }

  window.NYM_PRODUCTION_RATING = Object.freeze({ fetchRating, normalizeSymbol });
})();
