import type http from "node:http";
import type { Context } from "@/types";
import type { TokenStatsHourlyDbRecord } from "../../../storage/databaseTypes.js";
import { costsTokenStats } from "./costsTokenStats.js";

export type TokenStatsFetchOptions = {
    from?: number;
    to?: number;
    agentId?: string;
    model?: string;
    limit?: number;
};

export type CostsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
};

/**
 * Routes /costs requests to authenticated cost APIs.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: pathname starts with /costs; context.ctx carries authenticated userId.
 */
export async function costsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: CostsRouteContext
): Promise<boolean> {
    if (pathname === "/costs/token-stats" && request.method === "GET") {
        return costsTokenStats(request, response, context);
    }

    return false;
}
