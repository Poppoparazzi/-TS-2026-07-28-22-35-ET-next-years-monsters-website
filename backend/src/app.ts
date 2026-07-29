// TS: 2026-07-29 10:47 ET

import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { loadConfig } from "./config.js";
import { createMarketDataProvider } from "./providers/index.js";
import { ProviderNotConfiguredError } from "./providers/types.js";

interface TickerQuery {
  readonly q?: string;
  readonly limit?: string;
}

interface QuoteParams {
  readonly symbol: string;
}

export async function buildApp(): Promise<FastifyInstance> {
  const config = loadConfig();
  const provider = createMarketDataProvider(config);
  const app = Fastify({
    logger: {
      level: config.nodeEnv === "production" ? "info" : "debug",
    },
  });

  const allowedOrigins = [...config.corsOrigins];

  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ["GET", "OPTIONS"],
  });

  app.get("/api/health", async () => ({
    status: "ok",
    service: "next-years-monsters-api",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    marketData: {
      provider: provider.name,
      configured: provider.configured,
    },
  }));

  app.get("/api/provider-status", async () => ({
    marketData: {
      provider: provider.name,
      configured: provider.configured,
      secretExposed: false,
    },
    sec: {
      configured: Boolean(config.secUserAgent),
      userAgentExposed: false,
    },
    timestamp: new Date().toISOString(),
  }));

  app.get<{ Querystring: TickerQuery }>("/api/tickers", async (request, reply) => {
    const query = request.query.q?.trim() ?? "";

    if (!query) {
      return reply.code(400).send({
        error: "missing_query",
        message: "Provide a ticker or company query using ?q=.",
      });
    }

    const requestedLimit = Number(request.query.limit ?? "10");
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 10;
    const results = await provider.searchTickers(query, limit);

    return {
      query,
      count: results.length,
      results,
      provider: provider.name,
      retrievedAt: new Date().toISOString(),
    };
  });

  app.get<{ Params: QuoteParams }>("/api/quotes/:symbol", async (request) => {
    return provider.getQuote(request.params.symbol);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      error instanceof ProviderNotConfiguredError
        ? 503
        : typeof error.statusCode === "number"
          ? error.statusCode
          : 500;

    request.log.error({ error, statusCode }, "API request failed");

    return reply.code(statusCode).send({
      error:
        error instanceof ProviderNotConfiguredError
          ? "provider_not_configured"
          : "request_failed",
      message:
        statusCode >= 500 && !(error instanceof ProviderNotConfiguredError)
          ? "The data service could not complete the request."
          : error.message,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
