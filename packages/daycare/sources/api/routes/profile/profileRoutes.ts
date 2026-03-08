import type http from "node:http";
import type { Context } from "@/types";
import type { EngineEventBus } from "../../../engine/ipc/events.js";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import { profileEmailConnectRequest } from "./profileEmailConnectRequest.js";
import { profileRead } from "./profileRead.js";
import { profileUpdate } from "./profileUpdate.js";

export type ProfileRouteContext = {
    ctx: Context;
    users: UsersRepository | null;
    eventBus: EngineEventBus | null;
    emailConnectRequest: ((userId: string, email: string) => Promise<void>) | null;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
};

/**
 * Routes authenticated profile requests.
 * Returns true if a profile endpoint handled the request.
 */
export async function profileRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: ProfileRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/profile")) {
        return false;
    }

    if (!context.users) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Users repository unavailable."
        });
        return true;
    }

    if (pathname === "/profile" && request.method === "GET") {
        const result = await profileRead({
            ctx: context.ctx,
            users: context.users
        });
        context.sendJson(response, result.ok ? 200 : 404, result);
        return true;
    }

    if (pathname === "/profile/update" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await profileUpdate({
            ctx: context.ctx,
            users: context.users,
            eventBus: context.eventBus,
            body
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/profile/email/connect/request" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await profileEmailConnectRequest({
            ctx: context.ctx,
            request: context.emailConnectRequest,
            body
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    return false;
}
