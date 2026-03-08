import type http from "node:http";
import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import { configRead } from "./configRead.js";

export type ConfigRouteContext = {
    ctx: Context;
    users: UsersRepository | null;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
};

/**
 * Routes workspace-scoped configuration requests.
 * Returns true if a config endpoint handled the request.
 */
export async function configRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: ConfigRouteContext
): Promise<boolean> {
    if (pathname !== "/config" || request.method !== "GET") {
        return false;
    }

    if (!context.users) {
        context.sendJson(response, 503, { ok: false, error: "Users repository unavailable." });
        return true;
    }

    const result = await configRead({ ctx: context.ctx, users: context.users });
    context.sendJson(response, 200, result);
    return true;
}
