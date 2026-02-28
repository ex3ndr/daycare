import type http from "node:http";
import type { CostsRouteContext } from "./costsRoutes.js";

/**
 * Handles GET /costs/token-stats with optional query params: from, to, agentId, model, limit.
 * Returns hourly token/cost rollups scoped to the authenticated user.
 *
 * Expects: context.tokenStatsFetch is available; context.ctx carries authenticated userId.
 */
export async function costsTokenStats(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    context: CostsRouteContext
): Promise<boolean> {
    if (!context.tokenStatsFetch) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Token stats unavailable."
        });
        return true;
    }

    const url = new URL(request.url ?? "/", "http://localhost");
    const from = numberParamParse(url.searchParams.get("from"));
    const to = numberParamParse(url.searchParams.get("to"));
    const agentId = url.searchParams.get("agentId") ?? undefined;
    const model = url.searchParams.get("model") ?? undefined;
    const limit = numberParamParse(url.searchParams.get("limit"));

    const rows = await context.tokenStatsFetch(context.ctx, { from, to, agentId, model, limit });
    context.sendJson(response, 200, { ok: true, rows });
    return true;
}

function numberParamParse(value: string | null): number | undefined {
    if (value === null) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
