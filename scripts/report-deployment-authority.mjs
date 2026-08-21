// TS: 2026-08-21 11:01 ET

import { appendFileSync } from "node:fs";

const present = (value) => Boolean(String(value ?? "").trim());

const renderDeployHook = present(process.env.RENDER_DEPLOY_HOOK_URL);
const renderApiKey = present(process.env.RENDER_API_KEY);
const renderServiceId = present(process.env.RENDER_SERVICE_ID);
const vercelToken = present(process.env.VERCEL_TOKEN);

const renderApiPair = renderApiKey && renderServiceId;
const renderAuthorized = renderDeployHook || renderApiPair;
const renderMethod = renderDeployHook ? "deploy_hook" : renderApiPair ? "api" : "none";

const missingRender = [];
if (!renderDeployHook) missingRender.push("RENDER_DEPLOY_HOOK_URL");
if (!renderApiKey) missingRender.push("RENDER_API_KEY");
if (!renderServiceId) missingRender.push("RENDER_SERVICE_ID");

const status = Object.freeze({
  render: {
    authorized: renderAuthorized,
    method: renderMethod,
    deployHookAvailable: renderDeployHook,
    apiKeyAvailable: renderApiKey,
    serviceIdAvailable: renderServiceId,
    missing: Object.freeze(missingRender),
  },
  vercel: {
    authorized: vercelToken,
    tokenAvailable: vercelToken,
    missing: Object.freeze(vercelToken ? [] : ["VERCEL_TOKEN"]),
  },
});

console.log("Deployment authority diagnostic:");
console.log(JSON.stringify(status, null, 2));

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `render_method=${renderMethod}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_authorized=${renderAuthorized}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_deploy_hook_available=${renderDeployHook}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_api_key_available=${renderApiKey}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_service_id_available=${renderServiceId}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_missing=${missingRender.join(",")}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `vercel_authorized=${vercelToken}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `vercel_missing=${vercelToken ? "" : "VERCEL_TOKEN"}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const renderSummary = renderAuthorized
    ? `Render deployment authority is available via **${renderMethod === "deploy_hook" ? "deploy hook" : "API credentials"}**.`
    : [
        "Render deployment authority is blocked.",
        `Missing deploy-hook path: **${renderDeployHook ? "none" : "RENDER_DEPLOY_HOOK_URL"}**.`,
        `Missing API path members: **${[!renderApiKey ? "RENDER_API_KEY" : null, !renderServiceId ? "RENDER_SERVICE_ID" : null].filter(Boolean).join(", ") || "none"}**.`,
      ].join(" ");

  const vercelSummary = vercelToken
    ? "Vercel collateral authority is available."
    : "Vercel collateral authority is blocked by missing **VERCEL_TOKEN**.";

  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Deployment authority\n\n${renderSummary}\n\n${vercelSummary}\n`,
  );
}
