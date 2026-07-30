// TS: 2026-07-30 11:15 ET

function startCoverageFinderGuide() {
  const input = document.querySelector("[data-coverage-finder-input]");
  const examples = [...document.querySelectorAll("[data-coverage-example]")];

  if (!input || !examples.length) return;

  examples.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.coverageExample || "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startCoverageFinderGuide);
} else {
  startCoverageFinderGuide();
}
