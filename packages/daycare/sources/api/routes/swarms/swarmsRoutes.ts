import type http from "node:http";
import type { Context } from "@/types";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { SecretsRuntime } from "../secrets/secretsTypes.js";
import { swarmsSecretsCopy } from "./swarmsSecretsCopy.js";
import { swarmsSecretsCreate } from "./swarmsSecretsCreate.js";
import { swarmsSecretsDelete } from "./swarmsSecretsDelete.js";
import { swarmsSecretsList } from "./swarmsSecretsList.js";
import { swarmsSecretsUpdate } from "./swarmsSecretsUpdate.js";

export type SwarmsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    users: UsersRepository | null;
    secrets: SecretsRuntime | null;
};

/**
 * Routes authenticated swarm secret APIs.
 * Returns true when a /swarms endpoint matched and handled.
 */
export async function swarmsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: SwarmsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/swarms")) {
        return false;
    }

    if (!context.users || !context.secrets) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Swarms runtime unavailable."
        });
        return true;
    }

    const listMatch = pathname.match(/^\/swarms\/([^/]+)\/secrets$/);
    if (listMatch?.[1] && request.method === "GET") {
        const result = await swarmsSecretsList({
            ctx: context.ctx,
            nametag: decodeURIComponent(listMatch[1]),
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const copyMatch = pathname.match(/^\/swarms\/([^/]+)\/secrets\/copy$/);
    if (copyMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await swarmsSecretsCopy({
            ctx: context.ctx,
            nametag: decodeURIComponent(copyMatch[1]),
            body,
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const createMatch = pathname.match(/^\/swarms\/([^/]+)\/secrets\/create$/);
    if (createMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await swarmsSecretsCreate({
            ctx: context.ctx,
            nametag: decodeURIComponent(createMatch[1]),
            body,
            users: context.users,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : errorStatusResolve(result.error), result);
        return true;
    }

    const updateMatch = pathname.match(/^\/swarms\/([^/]+)\/secrets\/([^/]+)\/update$/);
    if (updateMatch?.[1] && updateMatch[2] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await swarmsSecretsUpdate({
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

    const deleteMatch = pathname.match(/^\/swarms\/([^/]+)\/secrets\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && deleteMatch[2] && request.method === "POST") {
        const result = await swarmsSecretsDelete({
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
    if (error === "Only the owner user can manage swarm secrets.") {
        return 403;
    }
    if (error === "Swarm not found." || error === "Secret not found." || error.startsWith("Secret not found:")) {
        return 404;
    }
    return 400;
}
