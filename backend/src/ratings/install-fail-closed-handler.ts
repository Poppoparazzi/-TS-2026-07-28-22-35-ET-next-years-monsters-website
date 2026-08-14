// TS: 2026-08-14 03:08 ET

import type { FastifyInstance } from "fastify";
import { ProviderNotConfiguredError } from "../providers/types.js";
import { buildFailClosedRatingResponse } from "./fail-closed-response.js";

export function installFailClosedRatingErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (request.url.startsWith("/api/ratings/")) {
      const symbol = request.url.split("?")[0]?.split("/").filter(Boolean).at(-1) ?? "UNKNOWN";
      const reason = error instanceof ProviderNotConfiguredError
        ? {
            code: "gate_marketQuote",
            message: "Current market-data evidence is not configured in the production rating service.",
          }
        : {
            code: "required_evidence_incomplete",
            message: "One or more required production evidence sources could not be retrieved.",
          };

      request.log.error({ error, symbol }, "Rating evidence retrieval failed closed");
      return reply.code(200).send(
        buildFailClosedRatingResponse(symbol, new Date().toISOString(), [reason]),
      );
    }

    const errorStatusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : null;
    const errorMessage = error instanceof Error ? error.message : "Request failed.";
    const statusCode =
      error instanceof ProviderNotConfiguredError
        ? 503
        : errorStatusCode !== null
          ? errorStatusCode
          : 500;

    request.log.error({ error, statusCode }, "API request failed");

    return reply.code(statusCode).send({
      error:
        error instanceof ProviderNotConfiguredError
          ? "provider_not_configured"
          : statusCode === 404
            ? "not_found"
            : "request_failed",
      message:
        statusCode >= 500 && !(error instanceof ProviderNotConfiguredError)
          ? "The data service could not complete the request."
          : errorMessage,
      timestamp: new Date().toISOString(),
    });
  });
}
