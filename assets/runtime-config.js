// TS: 2026-08-02 13:47 ET

window.NYM_CONFIG = Object.freeze({
  // Public backend address only. Never place an API key or private credential here.
  apiBaseUrl: "https://next-years-monsters-api.onrender.com",
});

(function loadLiveStatusHealthPanel() {
  const page = (window.location.pathname || "").split("/").filter(Boolean).pop();
  if (page !== "live-status.html") return;

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
})();
