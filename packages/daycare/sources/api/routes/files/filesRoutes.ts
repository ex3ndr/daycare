import type http from "node:http";
import { filesListDir } from "./filesListDir.js";
import { filesReadFile } from "./filesReadFile.js";
import { filesRoots } from "./filesRoots.js";

export type FilesRouteContext = {
    homeDir: string;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
};

/**
 * Routes authenticated file browser requests.
 * Returns true if a /files endpoint handled the request.
 */
export async function filesRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: FilesRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/files")) return false;

    // GET /files/roots
    if (pathname === "/files/roots" && request.method === "GET") {
        const result = filesRoots();
        context.sendJson(response, 200, result as unknown as Record<string, unknown>);
        return true;
    }

    // GET /files/list?path=...
    if (pathname === "/files/list" && request.method === "GET") {
        const url = new URL(request.url ?? pathname, "http://localhost");
        const requestedPath = url.searchParams.get("path") ?? "";
        const result = await filesListDir({ homeDir: context.homeDir, requestedPath });
        const statusCode = result.ok ? 200 : result.statusCode;
        context.sendJson(response, statusCode, result as unknown as Record<string, unknown>);
        return true;
    }

    // GET /files/read?path=...
    if (pathname === "/files/read" && request.method === "GET") {
        const url = new URL(request.url ?? pathname, "http://localhost");
        const requestedPath = url.searchParams.get("path") ?? "";
        const result = await filesReadFile({ homeDir: context.homeDir, requestedPath });
        const statusCode = result.ok ? 200 : result.statusCode;
        context.sendJson(response, statusCode, result as unknown as Record<string, unknown>);
        return true;
    }

    return false;
}
