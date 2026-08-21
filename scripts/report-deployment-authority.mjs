// TS: 2026-08-21 18:02 ET

import { appendFileSync, writeFileSync } from "node:fs";

const present = (value) => Boolean(String(value ?? "").trim());

const renderDeployHook = present(process.env.RENDER_DEPLOY_HOOK_URL);
const renderApiKey = present(process.env.RENDER_API_KEY);
const renderServiceId = present(process.env.RENDER_SERVICE_ID);
const vercelToken = present(process.env.VERCEL_TOKEN);

const renderApiPair = renderApiKey && renderServiceId;
const renderAuthorized = renderDeployHook || renderApiPair;
const renderMethod = renderDeployHook ? "deploy_hook" : renderApiPair ? "api" : "none";
const authorityStateFile = "nym-deployment-authority.json";

const missingApiMembers = Object.freeze([
  !renderApiKey ? "RENDER_API_KEY" : null,
  !renderServiceId ? "RENDER_SERVICE_ID" : null,
].filter(Boolean));

const missingRender = Object.freeze([
  !renderDeployHook ? "RENDER_DEPLOY_HOOK_URL" : null,
  ...missingApiMembers,
].filter(Boolean));

const recommendedAction = renderAuthorized
  ? renderMethod === "deploy_hook"
    ? "trigger_render_deploy_hook"
    : "trigger_render_api_deploy"
  : "configure_one_render_authorization_path";

const status = Object.freeze({
  generatedAt: new Date().toISOString(),
  render: {
    authorized: renderAuthorized,
    method: renderMethod,
    deployHookAvailable: renderDeployHook,
    apiKeyAvailable: renderApiKey,
    serviceIdAvailable: renderServiceId,
    deployHookPathMissing: Object.freeze(renderDeployHook ? [] : ["RENDER_DEPLOY_HOOK_URL"]),
    apiPathMissing: missingApiMembers,
    missing: missingRender,
    requiredAlternatives: Object.freeze([
      Object.freeze(["RENDER_DEPLOY_HOOK_URL"]),
      Object.freeze(["RENDER_API_KEY", "RENDER_SERVICE_ID"]),
    ]),
    recommendedAction,
  },
  vercel: {
    authorized: vercelToken,
    tokenAvailable: vercelToken,
    missing: Object.freeze(vercelToken ? [] : ["VERCEL_TOKEN"]),
    recommendedAction: vercelToken
      ? "dispatch_verified_vercel_collateral"
      : "configure_vercel_token",
  },
});

writeFileSync(authorityStateFile, `${JSON.stringify(status, null, 2)}\n`, "utf8");

console.log("Deployment authority diagnostic:");
console.log(JSON.stringify(status, null, 2));
console.log(`Deployment authority state written to ${authorityStateFile}.`);

if (process.env.GITHUB_OUTPUT) {
  // `method` preserves compatibility with the existing consolidated recovery workflow.
  appendFileSync(process.env.GITHUB_OUTPUT, `method=${renderMethod}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_method=${renderMethod}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_authorized=${renderAuthorized}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_deploy_hook_available=${renderDeployHook}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_api_key_available=${renderApiKey}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_service_id_available=${renderServiceId}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_missing=${missingRender.join(",")}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_api_path_missing=${missingApiMembers.join(",")}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `render_recommended_action=${recommendedAction}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `vercel_authorized=${vercelToken}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `vercel_missing=${vercelToken ? "" : "VERCEL_TOKEN"}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `authority_state_file=${authorityStateFile}\n`);
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const renderSummary = renderAuthorized
    ? `Render deployment authority is available via **${renderMethod === "deploy_hook" ? "deploy hook" : "API credentials"}**.`
    : [
        "Render deployment authority is blocked.",
        `Deploy-hook path missing: **${renderDeployHook ? "none" : "RENDER_DEPLOY_HOOK_URL"}**.`,
        `API path missing: **${missingApiMembers.join(", ") || "none"}**.`,
        "Either path is sufficient; both are not required.",
      ].join(" ");

  const vercelSummary = vercelToken
    ? "Vercel collateral authority is available."
    : "Vercel collateral authority is blocked by missing **VERCEL_TOKEN**.";

  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Deployment authority\n\n${renderSummary}\n\n${vercelSummary}\n\nState file: \`${authorityStateFile}\`.\n`,
  );
}
