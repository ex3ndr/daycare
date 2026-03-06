import type http from "node:http";
import type { Context } from "@/types";
import type { ObservationLogRepository } from "../../../storage/observationLogRepository.js";
import { observationsList } from "./observationsList.js";

export type ObservationsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    observationLog: ObservationLogRepository | null;
};

/**
 * Routes /observations requests to authenticated APIs.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: pathname starts with /observations; context.ctx carries authenticated userId.
 */
export async function observationsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: ObservationsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/observations")) {
        return false;
    }

    if (!context.observationLog) {
        context.sendJson(response, 503, { ok: false, error: "Observations unavailable." });
        return true;
    }

    if (pathname === "/observations" && request.method === "GET") {
        const url = new URL(request.url ?? pathname, "http://localhost");
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Math.min(1000, Math.max(1, Math.floor(Number(limitRaw)))) : 100;

        const repo = context.observationLog;
        const result = await observationsList({
            ctx: context.ctx,
            limit,
            fetchRecent: async (ctx, lim) => {
                const records = await repo.findRecent(ctx, { limit: lim });
                return records.map((r) => ({
                    id: r.id,
                    type: r.type,
                    source: r.source,
                    message: r.message,
                    details: r.details,
                    createdAt: r.createdAt
                }));
            }
        });
        context.sendJson(response, 200, result);
        return true;
    }

    return false;
}
