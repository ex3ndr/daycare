import type http from "node:http";
import type { Context } from "@/types";
import type { VaultsRepository } from "../../../storage/vaultsRepository.js";
import { vaultsCreate } from "./vaultsCreate.js";
import { vaultsDelete } from "./vaultsDelete.js";
import { vaultsFindById } from "./vaultsFindById.js";
import { vaultsHistory } from "./vaultsHistory.js";
import { vaultsTree } from "./vaultsTree.js";
import { vaultsUpdate } from "./vaultsUpdate.js";

export type VaultsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    documents: VaultsRepository;
};

/**
 * Routes authenticated document requests to the appropriate handler.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: ctx carries authenticated userId; documents repository is initialized.
 */
export async function vaultsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: VaultsRouteContext
): Promise<boolean> {
    if (pathname === "/vault/tree" && request.method === "GET") {
        await vaultsTree(request, response, context);
        return true;
    }

    const historyMatch = pathname.match(/^\/vault\/([^/]+)\/history$/);
    if (historyMatch?.[1] && request.method === "GET") {
        const id = decodeURIComponent(historyMatch[1]);
        await vaultsHistory(request, response, id, context);
        return true;
    }

    const updateMatch = pathname.match(/^\/vault\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        const id = decodeURIComponent(updateMatch[1]);
        await vaultsUpdate(request, response, id, context);
        return true;
    }

    const deleteMatch = pathname.match(/^\/vault\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && request.method === "POST") {
        const id = decodeURIComponent(deleteMatch[1]);
        await vaultsDelete(request, response, id, context);
        return true;
    }

    const idMatch = pathname.match(/^\/vault\/([^/]+)$/);
    if (idMatch?.[1] && request.method === "GET") {
        const id = decodeURIComponent(idMatch[1]);
        await vaultsFindById(request, response, id, context);
        return true;
    }

    if (pathname === "/vault/create" && request.method === "POST") {
        await vaultsCreate(request, response, context);
        return true;
    }

    return false;
}
