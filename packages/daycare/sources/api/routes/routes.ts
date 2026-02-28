import type http from "node:http";
import type { Context, TaskActiveSummary } from "@/types";
import type { TokenStatsHourlyDbRecord } from "../../storage/databaseTypes.js";
import type { TokenStatsFetchOptions } from "./costs/costsRoutes.js";
import { costsRouteHandle } from "./costs/costsRoutes.js";
import { promptsRouteHandle } from "./prompts/promptsRoutes.js";
import { tasksRouteHandle } from "./tasks/tasksRoutes.js";

export type ApiRouteContext = {
    ctx: Context;
    usersDir: string;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    tasksListActive: ((ctx: Context) => Promise<TaskActiveSummary[]>) | null;
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
};

/**
 * Central API route dispatcher. Routes authenticated requests to domain handlers.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: ctx carries authenticated userId; caller handles auth before calling this.
 */
export async function apiRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: ApiRouteContext
): Promise<boolean> {
    if (pathname.startsWith("/prompts")) {
        return promptsRouteHandle(request, response, pathname, context);
    }
    if (pathname.startsWith("/tasks")) {
        return tasksRouteHandle(request, response, pathname, context);
    }
    if (pathname.startsWith("/costs")) {
        return costsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            tokenStatsFetch: context.tokenStatsFetch
        });
    }

    return false;
}
