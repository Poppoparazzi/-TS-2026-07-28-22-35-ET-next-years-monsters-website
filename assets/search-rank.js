// TS: 2026-08-04 22:31 ET

(() => {
  "use strict";

  function normalize(value) {
    return String(value ?? "").trim().toUpperCase();
  }

  function rank(company, query) {
    const needle = normalize(query);
    if (!needle) return Number.POSITIVE_INFINITY;

    const ticker = normalize(company?.ticker);
    const companyName = normalize(company?.companyName || company?.name);
    const companyWords = companyName.split(/[^A-Z0-9]+/).filter(Boolean);

    if (ticker === needle) return 0;
    if (companyName === needle) return 1;
    if (ticker.startsWith(needle)) return 2;
    if (companyName.startsWith(needle)) return 3;
    if (companyWords.some((word) => word.startsWith(needle))) return 4;
    if (ticker.includes(needle)) return 5;
    if (companyName.includes(needle)) return 6;
    return Number.POSITIVE_INFINITY;
  }

  function compare(left, right, query) {
    const rankDifference = rank(left, query) - rank(right, query);
    return rankDifference || normalize(left?.ticker).localeCompare(normalize(right?.ticker));
  }

  window.NYM_SEARCH_RANK = Object.freeze({ normalize, rank, compare });
})();
