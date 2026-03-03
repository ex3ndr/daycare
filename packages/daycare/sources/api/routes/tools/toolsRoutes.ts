import type http from "node:http";
import type { Tool } from "@mariozechner/pi-ai";
import { toolsFileDownload } from "./toolsFileDownload.js";
import { toolsList } from "./toolsList.js";

export type ToolsRouteContext = {
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    tools: {
        list: () => Tool[];
    } | null;
};

/**
 * Routes authenticated tool APIs.
 * Returns true if a /tools endpoint handled the request.
 */
export function toolsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: ToolsRouteContext
): boolean {
    if (!pathname.startsWith("/tools")) {
        return false;
    }

    if (!context.tools) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Tool runtime unavailable."
        });
        return true;
    }

    if (pathname === "/tools" && request.method === "GET") {
        const result = toolsList({ tools: context.tools });
        context.sendJson(response, 200, result);
        return true;
    }

    const downloadMatch = pathname.match(/^\/tools\/([^/]+)\/download$/);
    if (downloadMatch?.[1] && request.method === "GET") {
        const result = toolsFileDownload({
            tools: context.tools,
            toolName: decodeURIComponent(downloadMatch[1])
        });
        if (!result.ok) {
            context.sendJson(response, result.statusCode, {
                ok: false,
                error: result.error
            });
            return true;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", result.file.mimeType);
        response.setHeader("Content-Length", String(result.content.length));
        response.setHeader(
            "Content-Disposition",
            `attachment; filename="${contentDispositionFilename(result.file.filename)}"`
        );
        response.end(result.content);
        return true;
    }

    return false;
}

function contentDispositionFilename(filename: string): string {
    return filename.replaceAll("\\", "_").replaceAll('"', "_").replaceAll("\r", "_").replaceAll("\n", "_");
}
