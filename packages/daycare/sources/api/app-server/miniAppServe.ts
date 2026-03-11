import { promises as fs } from "node:fs";
import type http from "node:http";
import path from "node:path";
import { appCorsApply } from "./appHttp.js";
import { miniAppTokenVerify } from "./miniAppToken.js";

export type MiniAppServeInput = {
    requestPathname: string;
    response: http.ServerResponse;
    secret: string;
    rootDirectoryResolve: (userId: string, appId: string, version: number) => Promise<string | null>;
};

/**
 * Serves token-scoped mini-app static files and SPA fallbacks from /mini-apps/s/:token/*.
 * Returns true when the pathname matches the serving prefix.
 */
export async function miniAppServe(input: MiniAppServeInput): Promise<boolean> {
    const match = input.requestPathname.match(/^\/mini-apps\/s\/([^/]+)(\/.*)?$/);
    if (!match?.[1]) {
        return false;
    }

    try {
        const token = decodeURIComponent(match[1]);
        const verified = await miniAppTokenVerify(token, input.secret);
        const rootDirectory = await input.rootDirectoryResolve(verified.userId, verified.appId, verified.version);
        if (!rootDirectory) {
            sendError(input.response, 404, "Mini app not found.");
            return true;
        }

        const requestedPath = match[2] ?? "/";
        const relativePath = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
        const resolvedFile = await miniAppFileResolve(rootDirectory, relativePath);
        const content = await fs.readFile(resolvedFile.absolutePath);
        appCorsApply(input.response);
        input.response.writeHead(200, {
            "content-type": miniAppMimeTypeResolve(resolvedFile.absolutePath),
            "cache-control": resolvedFile.relativePath === "index.html" ? "no-store" : "public, max-age=300"
        });
        if (resolvedFile.relativePath === "index.html") {
            input.response.end(
                miniAppHtmlPrepare(content.toString("utf8"), `/mini-apps/s/${encodeURIComponent(token)}/`)
            );
            return true;
        }
        input.response.end(content);
        return true;
    } catch (error) {
        sendError(input.response, 404, error instanceof Error ? error.message : "Mini app not found.");
        return true;
    }
}

async function miniAppFileResolve(
    rootDirectory: string,
    requestedPath: string
): Promise<{ absolutePath: string; relativePath: string }> {
    const normalized = path.posix.normalize(`/${requestedPath}`);
    if (normalized.includes("/../")) {
        throw new Error("Mini app path is invalid.");
    }

    const relativePath = normalized === "/" ? "index.html" : normalized.slice(1);
    const absolutePath = path.resolve(rootDirectory, relativePath.split("/").join(path.sep));
    const relative = path.relative(rootDirectory, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error("Mini app path escapes app root.");
    }

    const stat = await fs.stat(absolutePath).catch(() => null);
    if (stat?.isFile()) {
        return { absolutePath, relativePath };
    }
    return {
        absolutePath: path.join(rootDirectory, "index.html"),
        relativePath: "index.html"
    };
}

function miniAppHtmlPrepare(html: string, baseHref: string): string {
    const baseTag = `<base href="${baseHref}">`;
    const cspTag =
        "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self' data: blob:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; frame-ancestors 'self'\">"; // best-effort same-origin scope
    if (/<head[^>]*>/i.test(html)) {
        return html.replace(/<head([^>]*)>/i, `<head$1>${baseTag}${cspTag}`);
    }
    return `${baseTag}${cspTag}${html}`;
}

function miniAppMimeTypeResolve(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".txt": "text/plain; charset=utf-8"
    };
    return types[ext] ?? "application/octet-stream";
}

function sendError(response: http.ServerResponse, statusCode: number, message: string): void {
    appCorsApply(response);
    response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
    });
    response.end(`${JSON.stringify({ ok: false, error: message })}\n`);
}
