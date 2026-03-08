import type http from "node:http";
import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../../storage/workspaceMembersRepository.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { workspacesInviteCreate } from "./workspacesInviteCreate.js";
import { workspacesList } from "./workspacesList.js";
import { workspacesMemberKick } from "./workspacesMemberKick.js";
import { workspacesMembersList } from "./workspacesMembersList.js";
import { workspacesSecretsCopy } from "./workspacesSecretsCopy.js";
import { workspacesSecretsCreate } from "./workspacesSecretsCreate.js";
import { workspacesSecretsDelete } from "./workspacesSecretsDelete.js";
import { workspacesSecretsList } from "./workspacesSecretsList.js";
import { workspacesSecretsUpdate } from "./workspacesSecretsUpdate.js";

export type WorkspacesRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    users: UsersRepository | null;
    workspaceMembers: WorkspaceMembersRepository | null;
    secrets: SecretsRuntime | null;
    publicEndpoints?: {
        appEndpoint: string;
        serverEndpoint: string;
    } | null;
    secretResolve?: (() => Promise<string>) | null;
};

/**
 * Routes authenticated workspace secret APIs.
 * Returns true when a /workspaces endpoint matched and handled.
 */
export async function workspacesRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: WorkspacesRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/workspaces")) {
        return false;
    }

    if (!context.users || !context.workspaceMembers) {
        context.sendJson(response, 503, { ok: false, error: "Workspaces runtime unavailable." });
        return true;
    }

    // GET /workspaces — list accessible workspaces
    if (pathname === "/workspaces" && request.method === "GET") {
        const result = await workspacesList({
            ctx: context.ctx,
            users: context.users,
            workspaceMembers: context.workspaceMembers
        });
        context.sendJson(response, 200, result);
        return true;
    }

    const membersMatch = pathname.match(/^\/workspaces\/([^/]+)\/members$/);
    if (membersMatch?.[1] && request.method === "GET") {
        const result = await workspacesMembersList({
            ctx: context.ctx,
            nametag: decodeURIComponent(membersMatch[1]),
            users: context.users,
            workspaceMembers: context.workspaceMembers
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const inviteMatch = pathname.match(/^\/workspaces\/([^/]+)\/invite\/create$/);
    if (inviteMatch?.[1] && request.method === "POST") {
        if (!context.publicEndpoints || !context.secretResolve) {
            context.sendJson(response, 503, { ok: false, error: "Workspaces runtime unavailable." });
            return true;
        }
        const result = await workspacesInviteCreate({
            ctx: context.ctx,
            nametag: decodeURIComponent(inviteMatch[1]),
            users: context.users,
            workspaceMembers: context.workspaceMembers,
            publicEndpoints: context.publicEndpoints,
            secret: await context.secretResolve()
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const kickMatch = pathname.match(/^\/workspaces\/([^/]+)\/members\/([^/]+)\/kick$/);
    if (kickMatch?.[1] && kickMatch[2] && request.method === "POST") {
        const result = await workspacesMemberKick({
            ctx: context.ctx,
            nametag: decodeURIComponent(kickMatch[1]),
            userId: decodeURIComponent(kickMatch[2]),
            body: await context.readJsonBody(request),
            users: context.users,
            workspaceMembers: context.workspaceMembers
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    if (!context.secrets) {
        context.sendJson(response, 503, { ok: false, error: "Workspaces runtime unavailable." });
        return true;
    }

    const listMatch = pathname.match(/^\/workspaces\/([^/]+)\/secrets$/);
    if (listMatch?.[1] && request.method === "GET") {
        const result = await workspacesSecretsList({
            ctx: context.ctx,
            nametag: decodeURIComponent(listMatch[1]),
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const copyMatch = pathname.match(/^\/workspaces\/([^/]+)\/secrets\/copy$/);
    if (copyMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await workspacesSecretsCopy({
            ctx: context.ctx,
            nametag: decodeURIComponent(copyMatch[1]),
            body,
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const createMatch = pathname.match(/^\/workspaces\/([^/]+)\/secrets\/create$/);
    if (createMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await workspacesSecretsCreate({
            ctx: context.ctx,
            nametag: decodeURIComponent(createMatch[1]),
            body,
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const updateMatch = pathname.match(/^\/workspaces\/([^/]+)\/secrets\/([^/]+)\/update$/);
    if (updateMatch?.[1] && updateMatch[2] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await workspacesSecretsUpdate({
            ctx: context.ctx,
            nametag: decodeURIComponent(updateMatch[1]),
            name: decodeURIComponent(updateMatch[2]),
            body,
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const deleteMatch = pathname.match(/^\/workspaces\/([^/]+)\/secrets\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && deleteMatch[2] && request.method === "POST") {
        const result = await workspacesSecretsDelete({
            ctx: context.ctx,
            nametag: decodeURIComponent(deleteMatch[1]),
            name: decodeURIComponent(deleteMatch[2]),
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    return false;
}

function errorStatusResolve(error: string): number {
    if (
        error === "Only workspace owners can manage workspace secrets." ||
        error === "Only workspace owners can create invite links." ||
        error === "Only workspace owners can manage workspace members." ||
        error === "Workspace access denied."
    ) {
        return 403;
    }
    if (error === "Workspace not found." || error === "Secret not found." || error.startsWith("Secret not found:")) {
        return 404;
    }
    return 400;
}
