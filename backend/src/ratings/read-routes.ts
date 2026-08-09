// TS: 2026-08-09 11:04 ET

import type { FastifyInstance, FastifyReply } from "fastify";
import type { RatingReadStore } from "./read-store.js";

interface SymbolParams {
  readonly symbol: string;
}

interface HistoryQuery {
  readonly limit?: string;
}

function normalizeSymbol(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9.-]{1,15}$/.test(normalized) ? normalized : null;
}

function invalidSymbol(reply: FastifyReply) {
  return reply.code(400).send({
    error: "invalid_symbol",
    label: "Data Incomplete / Not Yet Rated",
    message: "Ticker symbols may contain only letters, numbers, periods, and hyphens.",
  });
}

function parseLimit(value: string | undefined): number {
  if (!value) return 20;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 100) : 20;
}

export async function registerRatingReadRoutes(
  app: FastifyInstance,
  store: RatingReadStore,
): Promise<void> {
  app.addHook("onClose", async () => store.close());

  app.get("/api/ratings/status", async () => store.getStatus());

  app.get<{ Params: SymbolParams }>("/api/ratings/:symbol", async (request, reply) => {
    const symbol = normalizeSymbol(request.params.symbol);
    if (!symbol) return invalidSymbol(reply);

    const result = await store.getCurrent(symbol);
    if (!result) {
      const status = await store.getStatus();
      return reply.code(404).send({
        error: "rating_not_found",
        symbol,
        eligible: false,
        score: null,
        label: "Data Incomplete / Not Yet Rated",
        engineVersion: null,
        calculatedAt: null,
        schemaReady: status.schemaReady,
        message: status.schemaReady
          ? `No stored production Current Stock Rating™ or eligibility result exists for ${symbol}.`
          : "Production rating storage is not ready yet. No score has been invented.",
      });
    }

    return result;
  });

  app.get<{ Params: SymbolParams; Querystring: HistoryQuery }>(
    "/api/ratings/:symbol/history",
    async (request, reply) => {
      const symbol = normalizeSymbol(request.params.symbol);
      if (!symbol) return invalidSymbol(reply);

      const history = await store.getHistory(symbol, parseLimit(request.query.limit));
      return {
        symbol,
        count: history.length,
        history,
        disclosure:
          history.length > 0
            ? "History contains only stored production calculations."
            : "No stored production Current Stock Rating™ history exists.",
      };
    },
  );
}
