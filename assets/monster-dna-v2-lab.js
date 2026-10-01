// TS: 2026-10-01 09:02 ET
(() => {
  "use strict";
  const tbody = document.querySelector("[data-lab-rows]");
  if (!tbody) return;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[char]);

  fetch("data/monster-dna-v2-april-2026-historical-lab.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Lab data unavailable");
      return response.json();
    })
    .then((data) => {
      const rows = Array.isArray(data.rows) ? data.rows : [];
      const winners = rows.filter((row) => row.outcomeBucket === "top_gainer").length;
      const losers = rows.filter((row) => row.outcomeBucket === "bottom_loser").length;
      const totalEl = document.querySelector("[data-lab-total]");
      const winnersEl = document.querySelector("[data-lab-winners]");
      const losersEl = document.querySelector("[data-lab-losers]");
      if (totalEl) totalEl.textContent = String(rows.length);
      if (winnersEl) winnersEl.textContent = String(winners);
      if (losersEl) losersEl.textContent = String(losers);

      tbody.innerHTML = rows.map((row) => {
        const move = Number(row.returnPct);
        const positive = Number.isFinite(move) && move >= 0;
        const evidenceStatus = row.v2EvidenceStatus === "initial_preperiod_review"
          ? "INITIAL REVIEW COMPLETE"
          : "RECONSTRUCTION PENDING";
        return `<tr>
          <td><strong>${esc(row.ticker)}</strong></td>
          <td>${row.outcomeBucket === "top_gainer" ? "MAJOR WINNER" : "MAJOR LOSER"}</td>
          <td class="${positive ? "lab-return-pos" : "lab-return-neg"}">${positive ? "+" : ""}${Number.isFinite(move) ? move.toFixed(2) : "—"}%</td>
          <td class="lab-status">${evidenceStatus}</td>
        </tr>`;
      }).join("");
    })
    .catch((error) => {
      tbody.innerHTML = `<tr><td colspan="4">Historical lab data could not be loaded. ${esc(error.message)}</td></tr>`;
    });
})();