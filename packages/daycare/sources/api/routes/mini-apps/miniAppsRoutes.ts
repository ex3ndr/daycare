import type http from "node:http";
import type { Context } from "@/types";
import type { MiniApps } from "../../../engine/mini-apps/MiniApps.js";
import { MiniAppIconError } from "../../../engine/mini-apps/miniAppIconError.js";
import { MINI_APP_ICON_FALLBACK, MINI_APP_OCTICON_NAMES } from "../../../engine/mini-apps/miniAppOcticons.js";

export type MiniAppsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    miniApps: MiniApps | null;
    launch: ((ctx: Context, id: string) => Promise<{ launchPath: string; expiresAt: number }>) | null;
};

/**
 * Routes authenticated /mini-apps endpoints for listing, versioning, and launch-token minting.
 * Returns true when a /mini-apps endpoint is matched.
 */
export async function miniAppsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: MiniAppsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/mini-apps")) {
        return false;
    }

    if (!context.miniApps) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Mini apps unavailable."
        });
        return true;
    }

    try {
        if (pathname === "/mini-apps" && request.method === "GET") {
            const apps = await context.miniApps.list(context.ctx);
            context.sendJson(response, 200, { ok: true, apps });
            return true;
        }

        if (pathname === "/mini-apps/icons" && request.method === "GET") {
            context.sendJson(response, 200, {
                ok: true,
                icons: MINI_APP_OCTICON_NAMES,
                fallbackIcon: MINI_APP_ICON_FALLBACK
            });
            return true;
        }

        if (pathname === "/mini-apps/create" && request.method === "POST") {
            const body = await context.readJsonBody(request);
            const app = await context.miniApps.create(context.ctx, {
                id: stringValue(body.id),
                title: stringValue(body.title),
                icon: stringValue(body.icon),
                html: stringValue(body.html),
                files: filesValue(body.files)
            });
            context.sendJson(response, 200, { ok: true, app });
            return true;
        }

        const readMatch = pathname.match(/^\/mini-apps\/([^/]+)$/);
        if (readMatch?.[1] && request.method === "GET") {
            const app = await context.miniApps.find(context.ctx, decodeURIComponent(readMatch[1]));
            if (!app) {
                context.sendJson(response, 404, { ok: false, error: "Mini app not found." });
                return true;
            }
            context.sendJson(response, 200, { ok: true, app });
            return true;
        }

        const launchMatch = pathname.match(/^\/mini-apps\/([^/]+)\/launch$/);
        if (launchMatch?.[1] && request.method === "GET") {
            if (!context.launch) {
                context.sendJson(response, 503, { ok: false, error: "Mini-app launch unavailable." });
                return true;
            }
            const launch = await context.launch(context.ctx, decodeURIComponent(launchMatch[1]));
            context.sendJson(response, 200, { ok: true, ...launch });
            return true;
        }

        const updateMatch = pathname.match(/^\/mini-apps\/([^/]+)\/update$/);
        if (updateMatch?.[1] && request.method === "POST") {
            const body = await context.readJsonBody(request);
            const app = await context.miniApps.update(context.ctx, decodeURIComponent(updateMatch[1]), {
                title: optionalStringValue(body.title),
                icon: optionalStringValue(body.icon),
                html: optionalStringValue(body.html),
                files: filesValue(body.files),
                deletePaths: stringArrayValue(body.deletePaths)
            });
            context.sendJson(response, 200, { ok: true, app });
            return true;
        }

        const deleteMatch = pathname.match(/^\/mini-apps\/([^/]+)\/delete$/);
        if (deleteMatch?.[1] && request.method === "POST") {
            const app = await context.miniApps.delete(context.ctx, decodeURIComponent(deleteMatch[1]));
            context.sendJson(response, 200, { ok: true, app });
            return true;
        }
    } catch (error) {
        if (error instanceof MiniAppIconError) {
            context.sendJson(response, 400, {
                ok: false,
                error: error.message,
                icons: error.icons,
                fallbackIcon: error.fallbackIcon
            });
            return true;
        }
        const message = error instanceof Error ? error.message : "Mini app request failed.";
        const statusCode = message.toLowerCase().includes("not found") ? 404 : 400;
        context.sendJson(response, statusCode, { ok: false, error: message });
        return true;
    }

    return false;
}

function stringValue(value: unknown): string {
    return typeof value === "string" ? value : "";
}

function optionalStringValue(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function stringArrayValue(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

function filesValue(value: unknown):
    | Array<{
          path: string;
          content: string;
          encoding?: "utf8" | "base64";
      }>
    | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    return value
        .filter((entry) => typeof entry === "object" && entry !== null)
        .map((entry) => ({
            path: stringValue((entry as Record<string, unknown>).path),
            content: stringValue((entry as Record<string, unknown>).content),
            encoding:
                (entry as Record<string, unknown>).encoding === "base64"
                    ? "base64"
                    : (entry as Record<string, unknown>).encoding === "utf8"
                      ? "utf8"
                      : undefined
        }));
}
