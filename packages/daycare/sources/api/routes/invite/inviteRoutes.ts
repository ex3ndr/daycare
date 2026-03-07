import type http from "node:http";
import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";
import { inviteAccept } from "./inviteAccept.js";

export type InviteRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    users: UsersRepository | null;
    workspaceMembers: WorkspaceMembersRepository | null;
    secretResolve: (() => Promise<string>) | null;
};

/**
 * Routes authenticated workspace invite endpoints.
 * Returns true when an /invite endpoint matched and handled.
 */
export async function inviteRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: InviteRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/invite")) {
        return false;
    }

    if (!context.users || !context.workspaceMembers || !context.secretResolve) {
        context.sendJson(response, 503, { ok: false, error: "Invite runtime unavailable." });
        return true;
    }

    if (pathname === "/invite/accept" && request.method === "POST") {
        const result = await inviteAccept({
            ctx: context.ctx,
            body: await context.readJsonBody(request),
            users: context.users,
            workspaceMembers: context.workspaceMembers,
            secret: await context.secretResolve()
        });
        context.sendJson(response, result.ok ? 200 : inviteErrorStatusResolve(result.error), result);
        return true;
    }

    return false;
}

function inviteErrorStatusResolve(error: string): number {
    if (error === "Workspace not found.") {
        return 404;
    }
    if (error === "You have been removed from this workspace.") {
        return 403;
    }
    return 400;
}
