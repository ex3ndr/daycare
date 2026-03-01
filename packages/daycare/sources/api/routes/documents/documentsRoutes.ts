import type http from "node:http";
import type { Context } from "@/types";
import type { DocumentsRepository } from "../../../storage/documentsRepository.js";
import { documentsCreate } from "./documentsCreate.js";
import { documentsDelete } from "./documentsDelete.js";
import { documentsFindById } from "./documentsFindById.js";
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
    if (pathname === "/documents/tree" && request.method === "GET") {
        await documentsTree(request, response, context);
        return true;
    }

    const idMatch = pathname.match(/^\/documents\/([^/]+)$/);
    if (idMatch?.[1]) {
        const id = decodeURIComponent(idMatch[1]);
        if (request.method === "GET") {
            await documentsFindById(request, response, id, context);
            return true;
        }
        if (request.method === "PUT") {
            await documentsUpdate(request, response, id, context);
            return true;
        }
        if (request.method === "DELETE") {
            await documentsDelete(request, response, id, context);
            return true;
        }
    }

    if (pathname === "/documents" && request.method === "POST") {
        await documentsCreate(request, response, context);
        return true;
    }

    return false;
}
