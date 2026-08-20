// TS: 2026-08-20 11:03 ET

import fs from "node:fs";

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const statusLimit = Number(process.env.NYM_UNIVERSE_STATUS_LIMIT || "5000");
const usableTarget = Number(process.env.NYM_EXPECTED_USABLE_TARGET || "2200");

if (!Number.isInteger(statusLimit) || statusLimit < usableTarget || statusLimit > 5_000) {
  throw new Error(`NYM_UNIVERSE_STATUS_LIMIT must be an integer from ${usableTarget} to 5000.`);
}
if (!Number.isInteger(usableTarget) || usableTarget < 1 || usableTarget > statusLimit) {
  throw new Error(`NYM_EXPECTED_USABLE_TARGET must be an integer from 1 to ${statusLimit}.`);
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(70_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${payload?.message || payload?.error || "no JSON error"}`);
  }
  return payload;
}

function appendStepSummary(lines) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
}

const status = await requestJson(`${apiBaseUrl}/api/universe/status?limit=${statusLimit}`);
const requiredCounts = [
  "universeSize",
  "examinedCount",
  "secIdentityCount",
  "secCompleteCount",
  "secEvidenceReadyCount",
  "filingCompleteCount",
  "factsCompleteCount",
  "failedCount",
  "unresolvedCount",
];
const problems = [];

for (const field of requiredCounts) {
  const value = Number(status?.[field]);
  if (!Number.isInteger(value) || value < 0) {
    problems.push(`${field}=${String(status?.[field])} is not a nonnegative integer`);
  }
}

const examined = Number(status?.examinedCount);
const secIdentity = Number(status?.secIdentityCount);
const secComplete = Number(status?.secCompleteCount);
const evidenceReady = Number(status?.secEvidenceReadyCount);
const filings = Number(status?.filingCompleteCount);
const facts = Number(status?.factsCompleteCount);
const failed = Number(status?.failedCount);

for (const [field, value] of [
  ["secIdentityCount", secIdentity],
  ["secCompleteCount", secComplete],
  ["secEvidenceReadyCount", evidenceReady],
  ["filingCompleteCount", filings],
  ["factsCompleteCount", facts],
]) {
  if (Number.isInteger(examined) && Number.isInteger(value) && value > examined) {
    problems.push(`${field}=${value} exceeds examinedCount=${examined}`);
  }
}

if (Number.isInteger(evidenceReady)) {
  if (Number.isInteger(secComplete) && evidenceReady > secComplete) {
    problems.push(`secEvidenceReadyCount=${evidenceReady} exceeds secCompleteCount=${secComplete}`);
  }
  if (Number.isInteger(secIdentity) && evidenceReady > secIdentity) {
    problems.push(`secEvidenceReadyCount=${evidenceReady} exceeds secIdentityCount=${secIdentity}`);
  }
  if (Number.isInteger(filings) && evidenceReady > filings) {
    problems.push(`secEvidenceReadyCount=${evidenceReady} exceeds filingCompleteCount=${filings}`);
  }
  if (Number.isInteger(facts) && evidenceReady > facts) {
    problems.push(`secEvidenceReadyCount=${evidenceReady} exceeds factsCompleteCount=${facts}`);
  }
}

if (Number.isInteger(failed) && failed > 0) {
  problems.push(`failedCount=${failed}; failed SEC records must be cleaned before reserve completion`);
}

const companies = Array.isArray(status?.companies) ? status.companies : [];
const incompleteProtected = companies.filter((company) =>
  company?.isPilot === true && !(
    company?.secStage === "complete" &&
    company?.hasSecIdentity === true &&
    company?.hasFilings === true &&
    company?.hasFacts === true
  ),
);
if (incompleteProtected.length > 0) {
  problems.push(
    `protected SEC evidence incomplete: ${incompleteProtected.map((company) => company.ticker).join(", ")}`,
  );
}

if (Number.isInteger(evidenceReady) && evidenceReady < usableTarget) {
  problems.push(`secEvidenceReadyCount=${evidenceReady}, target=${usableTarget}`);
}

const summary = {
  universeSize: status.universeSize,
  examinedCount: status.examinedCount,
  secCompleteCount: status.secCompleteCount,
  secEvidenceReadyCount: status.secEvidenceReadyCount,
  usableTarget,
  failedCount: status.failedCount,
  unresolvedCount: status.unresolvedCount,
  protectedIncompleteCount: incompleteProtected.length,
  generatedAt: status.generatedAt,
};

appendStepSummary([
  "### SEC evidence-ready production gate",
  "",
  `- Evidence-ready: **${String(summary.secEvidenceReadyCount)} / ${usableTarget}**`,
  `- SEC complete: **${String(summary.secCompleteCount)}**`,
  `- Failed SEC rows: **${String(summary.failedCount)}**`,
  `- Unresolved SEC rows: **${String(summary.unresolvedCount)}**`,
  `- Incomplete protected stocks: **${summary.protectedIncompleteCount}**`,
  `- Result: **${problems.length === 0 ? "PASS" : "BLOCKED"}**`,
  ...(problems.length === 0 ? [] : ["", ...problems.map((problem) => `- ${problem}`)]),
]);

if (problems.length > 0) {
  throw new Error(problems.join("; "));
}

console.log("SEC evidence-ready production verification passed.");
console.log(JSON.stringify(summary, null, 2));
