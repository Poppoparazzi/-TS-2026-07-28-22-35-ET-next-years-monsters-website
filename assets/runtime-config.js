// TS: 2026-08-13 17:00 ET

window.NYM_CONFIG = Object.freeze({
  // Public backend address only. Never place an API key or private credential here.
  apiBaseUrl: "https://next-years-monsters-api.onrender.com",
});

(function loadPageEnhancements() {
  const page = (window.location.pathname || "").split("/").filter(Boolean).pop();

  if (page === "live-status.html") {
    if (!document.querySelector('link[data-live-status-health-style]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "assets/live-status-health.css";
      link.dataset.liveStatusHealthStyle = "";
      document.head.append(link);
    }

    if (!document.querySelector('script[data-live-status-health-script]')) {
      const script = document.createElement("script");
      script.src = "assets/live-status-health.js";
      script.async = false;
      script.dataset.liveStatusHealthScript = "";
      document.head.append(script);
    }

    if (!document.querySelector('script[data-live-status-nav-script]')) {
      const script = document.createElement("script");
      script.src = "assets/live-status-nav.js?v=20260813-1510";
      script.defer = true;
      script.dataset.liveStatusNavScript = "";
      document.head.appendChild(script);
    }

    if (!document.querySelector('script[data-live-status-rating-service-script]')) {
      const script = document.createElement("script");
      script.src = "assets/live-status-rating-service.js?v=20260813-1659";
      script.defer = true;
      script.dataset.liveStatusRatingServiceScript = "";
      document.head.appendChild(script);
    }
  }

  const isHomePage = !page || page === "index.html";
  if (page === "monster-check.html" || isHomePage) {
    if (!document.querySelector('script[data-monster-rating-trio-script]')) {
      const script = document.createElement("script");
      script.src = "assets/monster-check-rating-trio.js?v=20260812-1402";
      script.defer = true;
      script.dataset.monsterRatingTrioScript = "";
      document.head.appendChild(script);
    }
  }

  if (page === "monster-check.html" && !document.querySelector('script[data-production-rating-client]')) {
    const script = document.createElement("script");
    script.src = "assets/production-rating-client.js?v=20260812-1501";
    script.defer = true;
    script.dataset.productionRatingClient = "";
    document.head.appendChild(script);
  }

  if (page === "monster-check.html" && !document.querySelector('script[data-rating-service-state-guard]')) {
    const script = document.createElement("script");
    script.src = "assets/rating-service-state-guard.js?v=20260813-1008";
    script.defer = true;
    script.dataset.ratingServiceStateGuard = "";
    document.head.appendChild(script);
  }
})();
