// TS: 2026-08-04 22:18 ET

const NYM_STATIC_DATA_VERSION = "2026-08-04.1";

window.NYM_CONFIG = Object.freeze({
  // Public backend address only. Never place an API key or private credential here.
  apiBaseUrl: "https://next-years-monsters-api.onrender.com",
  staticDataVersion: NYM_STATIC_DATA_VERSION,
});

window.NYM_STATIC_URL = (path) => {
  const separator = String(path).includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(NYM_STATIC_DATA_VERSION)}`;
};

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
