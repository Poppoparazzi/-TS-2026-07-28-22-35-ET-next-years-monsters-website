// TS: 2026-08-04 13:35 ET
(() => {
  const result = document.querySelector('[data-result]');
  if (!result) return;

  const standardizeResult = () => {
    const newsPlaceholder = result.querySelector('.monster-news-section');
    if (newsPlaceholder) newsPlaceholder.remove();

    result.querySelectorAll('.monster-demo-flag').forEach((label) => {
      const text = label.textContent.trim().toUpperCase();
      if (text.includes('DEMONSTRATION RATING')) {
        label.textContent = 'DEMONSTRATION RATING · NOT LIVE DATA';
      } else if (text.includes('OFFICIAL SEC COMPANY RECORD')) {
        label.textContent = 'OFFICIAL SEC EVIDENCE · NOT YET RATED';
      } else if (text.includes('SEC SERVICE TEMPORARILY UNAVAILABLE')) {
        label.textContent = 'PROVIDER NOT CONNECTED';
      } else if (text.includes('NO SEC COMPANY MATCH FOUND')) {
        label.textContent = 'UNRESOLVED SEC IDENTITY';
      }
    });
  };

  new MutationObserver(standardizeResult).observe(result, {
    childList: true,
    subtree: true,
  });
  standardizeResult();
})();
