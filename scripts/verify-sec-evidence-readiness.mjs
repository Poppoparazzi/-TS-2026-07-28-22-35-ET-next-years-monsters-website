// TS: 2026-08-21 04:00 ET

import fs from "node:fs";
import { isProtectedStock } from "./protected-stocks.mjs";

const apiBaseUrl = (process.env.NYM_API_BASE_URL || "https://next-years-monsters-api.onrender.com")
  .trim()
  .replace(/\/$/, "");
const statusLimit = Number(process.env.NYM_UNIVERSE_STATUS_LIMIT || "5000");
const usableTarget = Number(process.env.NYM_EXPECTED_USABLE_TARGET || "2200");
const recoveryStateFile = (process.env.NYM_RECOVERY_STATE_FILE || "nym-recovery-state.json").trim();

if (!Number.isInteger(statusLimit) || statusLimit < usableTarget || statusLimit > 5_000) {
  throw new Error(`NYM_UNIVERSE_STATUS_LIMIT must be an integer from ${usableTarget} to 5000.`);
}
if (!Number.isInteger(usableTarget) || usableTarget < 1 || usableTarget > statusLimit) {
  throw new Error(`NYM_EXPECTED_USABLE_TARGET must be an integer from 1 to ${statusLimit}.`);
}
if (!recoveryStateFile) {
  throw new Error("NYM_RECOVERY_STATE_FILE must not be empty.");
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

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`);
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
  isProtectedStock(company) && !(
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
  protectedIncompleteTickers: incompleteProtected.map((company) => company.ticker),
  generatedAt: status.generatedAt,
};
const result = problems.length === 0 ? "pass" : "blocked";
const recoveryState = {
  result,
  ...summary,
  problems,
  recordedAt: new Date().toISOString(),
};

fs.writeFileSync(recoveryStateFile, `${JSON.stringify(recoveryState, null, 2)}\n`, "utf8");

appendOutput("result", result);
appendOutput("evidence_ready_count", summary.secEvidenceReadyCount);
appendOutput("usable_target", usableTarget);
appendOutput("examined_count", summary.examinedCount);
appendOutput("failed_count", summary.failedCount);
appendOutput("unresolved_count", summary.unresolvedCount);
appendOutput("protected_incomplete_count", summary.protectedIncompleteCount);
appendOutput("protected_incomplete_tickers", summary.protectedIncompleteTickers.join(","));
appendOutput("recovery_state_file", recoveryStateFile);

appendStepSummary([
  "### SEC evidence-ready production gate",
  "",
  `- Evidence-ready: **${String(summary.secEvidenceReadyCount)} / ${usableTarget}**`,
  `- SEC complete: **${String(summary.secCompleteCount)}**`,
  `- Failed SEC rows: **${String(summary.failedCount)}**`,
  `- Unresolved SEC rows: **${String(summary.unresolvedCount)}**`,
  `- Incomplete protected stocks: **${summary.protectedIncompleteCount}**`,
  ...(summary.protectedIncompleteTickers.length === 0
    ? []
    : [`- Protected stocks needing repair: **${summary.protectedIncompleteTickers.join(", ")}**`]),
  `- Recovery-state file: **${recoveryStateFile}**`,
  `- Result: **${problems.length === 0 ? "PASS" : "BLOCKED"}**`,
  ...(problems.length === 0 ? [] : ["", ...problems.map((problem) => `- ${problem}`)]),
]);

if (problems.length > 0) {
  throw new Error(problems.join("; "));
}

console.log("SEC evidence-ready production verification passed.");
console.log(JSON.stringify(summary, null, 2));
