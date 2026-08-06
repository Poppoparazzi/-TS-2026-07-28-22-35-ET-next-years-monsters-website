// TS: 2026-08-05 08:31 ET

import type { FastifyInstance, FastifyReply } from "fastify";
import type { RatingStore } from "./store.js";

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
    message: "Ticker symbols may contain only letters, numbers, periods, and hyphens.",
  });
}

function parseLimit(value: string | undefined): number {
  if (!value) return 20;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), 100) : 20;
}

export async function registerRatingRoutes(
  app: FastifyInstance,
  ratingStore: RatingStore,
): Promise<void> {
  app.addHook("onClose", async () => ratingStore.close());

  app.get("/api/ratings/status", async () => ratingStore.getStatus());

  app.get<{ Params: SymbolParams }>("/api/ratings/:symbol", async (request, reply) => {
    const symbol = normalizeSymbol(request.params.symbol);
    if (!symbol) return invalidSymbol(reply);
    const result = await ratingStore.getCurrent(symbol);
    if (!result) {
      return reply.code(404).send({
        error: "rating_not_found",
        symbol,
        label: "Not Yet Rated",
        message: `No stored production Monster Rating™ or eligibility result exists for ${symbol}.`,
      });
    }
    return result;
  });

  app.get<{ Params: SymbolParams }>(
    "/api/ratings/:symbol/components",
    async (request, reply) => {
      const symbol = normalizeSymbol(request.params.symbol);
      if (!symbol) return invalidSymbol(reply);
      const result = await ratingStore.getCurrent(symbol);
      if (!result) {
        return reply.code(404).send({
          error: "rating_not_found",
          symbol,
          label: "Not Yet Rated",
          message: `No stored production rating evidence exists for ${symbol}.`,
        });
      }
      return {
        symbol,
        eligible: result.eligible,
        engineVersion: result.engineVersion,
        calculatedAt: result.calculatedAt,
        dataAsOf: result.dataAsOf,
        dataCompletenessScore: result.dataCompletenessScore,
        components: result.components,
        evidenceInputs: result.evidenceInputs,
        reasons: result.eligible ? [] : result.reasons,
      };
    },
  );

  app.get<{ Params: SymbolParams; Querystring: HistoryQuery }>(
    "/api/ratings/:symbol/history",
    async (request, reply) => {
      const symbol = normalizeSymbol(request.params.symbol);
      if (!symbol) return invalidSymbol(reply);
      const history = await ratingStore.getHistory(symbol, parseLimit(request.query.limit));
      return {
        symbol,
        count: history.length,
        history,
        disclosure:
          history.length > 0
            ? "Rating history contains only stored production calculations."
            : "No stored production rating history exists.",
      };
    },
  );
}
