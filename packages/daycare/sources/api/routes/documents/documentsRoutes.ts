import type http from "node:http";
import type { Context } from "@/types";
import type { DocumentsRepository } from "../../../storage/documentsRepository.js";
import { documentsCreate } from "./documentsCreate.js";
import { documentsDelete } from "./documentsDelete.js";
import { documentsFindById } from "./documentsFindById.js";
import { documentsHistory } from "./documentsHistory.js";
import { documentsTree } from "./documentsTree.js";
import { documentsUpdate } from "./documentsUpdate.js";

export type DocumentsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    documents: DocumentsRepository;
};

/**
 * Routes authenticated document requests to the appropriate handler.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: ctx carries authenticated userId; documents repository is initialized.
 */
export async function documentsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: DocumentsRouteContext
): Promise<boolean> {
    if (pathname === "/vault/tree" && request.method === "GET") {
        await documentsTree(request, response, context);
        return true;
    }

    const historyMatch = pathname.match(/^\/vault\/([^/]+)\/history$/);
    if (historyMatch?.[1] && request.method === "GET") {
        const id = decodeURIComponent(historyMatch[1]);
        await documentsHistory(request, response, id, context);
        return true;
    }

    const updateMatch = pathname.match(/^\/vault\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        const id = decodeURIComponent(updateMatch[1]);
        await documentsUpdate(request, response, id, context);
        return true;
    }

    const deleteMatch = pathname.match(/^\/vault\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && request.method === "POST") {
        const id = decodeURIComponent(deleteMatch[1]);
        await documentsDelete(request, response, id, context);
        return true;
    }

    const idMatch = pathname.match(/^\/vault\/([^/]+)$/);
    if (idMatch?.[1] && request.method === "GET") {
        const id = decodeURIComponent(idMatch[1]);
        await documentsFindById(request, response, id, context);
        return true;
    }

    if (pathname === "/vault/create" && request.method === "POST") {
        await documentsCreate(request, response, context);
        return true;
    }

    return false;
}
