import type http from "node:http";
import type { Context } from "../../engine/agents/context.js";
import { promptsList } from "./promptsList.js";
import { promptsRead } from "./promptsRead.js";
import { promptsWrite } from "./promptsWrite.js";

export type PromptsRouteContext = {
    ctx: Context;
    usersDir: string;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
};

/**
 * Routes /prompts requests to the appropriate handler.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: pathname starts with /prompts; context.ctx carries authenticated userId.
 */
export async function promptsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: PromptsRouteContext
): Promise<boolean> {
    // GET /prompts — list available prompt files
    if (pathname === "/prompts" && request.method === "GET") {
        const result = promptsList();
        context.sendJson(response, 200, result);
        return true;
    }

    // Match /prompts/:filename
    const match = pathname.match(/^\/prompts\/([^/]+)$/);
    if (!match) {
        return false;
    }
    const filename = decodeURIComponent(match[1]!);

    // GET /prompts/:filename — read prompt content
    if (request.method === "GET") {
        const result = await promptsRead({
            ctx: context.ctx,
            usersDir: context.usersDir,
            filename
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    // PUT /prompts/:filename — update prompt content
    if (request.method === "PUT") {
        const body = await context.readJsonBody(request);
        const content = typeof body.content === "string" ? body.content : null;
        if (content === null) {
            context.sendJson(response, 400, { ok: false, error: "content is required." });
            return true;
        }
        const result = await promptsWrite({
            ctx: context.ctx,
            usersDir: context.usersDir,
            filename,
            content
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    return false;
}
