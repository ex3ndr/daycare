import type http from "node:http";
import type { Context } from "@/types";
import type { PsqlService } from "../../../services/psql/PsqlService.js";
import { psqlTableSchemaApplyIs } from "../../../services/psql/psqlTypes.js";

export type DatabasesRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    psql: PsqlService | null;
};

/**
 * Routes authenticated /databases endpoints for psql service operations.
 * Returns true when a /databases endpoint is matched.
 */
export async function databasesRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: DatabasesRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/databases")) {
        return false;
    }

    if (!context.psql) {
        context.sendJson(response, 503, {
            ok: false,
            error: "PSQL service unavailable."
        });
        return true;
    }

    try {
        if (pathname === "/databases" && request.method === "GET") {
            const databases = await context.psql.listDatabases(context.ctx);
            context.sendJson(response, 200, { ok: true, databases });
            return true;
        }

        if (pathname === "/databases/create" && request.method === "POST") {
            const body = await context.readJsonBody(request);
            const name = typeof body.name === "string" ? body.name : "";
            const database = await context.psql.createDatabase(context.ctx, name);
            context.sendJson(response, 200, { ok: true, database });
            return true;
        }

        const getSchemaMatch = pathname.match(/^\/databases\/([^/]+)\/schema$/);
        if (getSchemaMatch?.[1] && request.method === "GET") {
            const dbId = decodeURIComponent(getSchemaMatch[1]);
            const schema = await context.psql.getSchema(context.ctx, dbId);
            context.sendJson(response, 200, { ok: true, schema });
            return true;
        }

        const applySchemaMatch = pathname.match(/^\/databases\/([^/]+)\/schema$/);
        if (applySchemaMatch?.[1] && request.method === "POST") {
            const dbId = decodeURIComponent(applySchemaMatch[1]);
            const body = await context.readJsonBody(request);
            if (!psqlTableSchemaApplyIs(body)) {
                throw new Error("schema body is invalid.");
            }
            const result = await context.psql.applySchema(context.ctx, dbId, body);
            const statusCode = result.errors.length > 0 ? 400 : 200;
            context.sendJson(response, statusCode, {
                ok: result.errors.length === 0,
                result
            });
            return true;
        }

        const addMatch = pathname.match(/^\/databases\/([^/]+)\/add$/);
        if (addMatch?.[1] && request.method === "POST") {
            const dbId = decodeURIComponent(addMatch[1]);
            const body = await context.readJsonBody(request);
            const table = typeof body.table === "string" ? body.table : "";
            const data = dataObjectRead(body.data);
            const row = await context.psql.add(context.ctx, dbId, table, data);
            context.sendJson(response, 200, { ok: true, row });
            return true;
        }

        const updateMatch = pathname.match(/^\/databases\/([^/]+)\/update$/);
        if (updateMatch?.[1] && request.method === "POST") {
            const dbId = decodeURIComponent(updateMatch[1]);
            const body = await context.readJsonBody(request);
            const table = typeof body.table === "string" ? body.table : "";
            const id = typeof body.id === "string" ? body.id : "";
            const data = dataObjectRead(body.data);
            const row = await context.psql.update(context.ctx, dbId, table, id, data);
            context.sendJson(response, 200, { ok: true, row });
            return true;
        }

        const deleteMatch = pathname.match(/^\/databases\/([^/]+)\/delete$/);
        if (deleteMatch?.[1] && request.method === "POST") {
            const dbId = decodeURIComponent(deleteMatch[1]);
            const body = await context.readJsonBody(request);
            const table = typeof body.table === "string" ? body.table : "";
            const id = typeof body.id === "string" ? body.id : "";
            const row = await context.psql.delete(context.ctx, dbId, table, id);
            context.sendJson(response, 200, { ok: true, row });
            return true;
        }

        const queryMatch = pathname.match(/^\/databases\/([^/]+)\/query$/);
        if (queryMatch?.[1] && request.method === "POST") {
            const dbId = decodeURIComponent(queryMatch[1]);
            const body = await context.readJsonBody(request);
            const sql = typeof body.sql === "string" ? body.sql : "";
            const params = Array.isArray(body.params) ? body.params : [];
            const rows = await context.psql.query(context.ctx, dbId, sql, params);
            context.sendJson(response, 200, { ok: true, rows });
            return true;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "PSQL operation failed.";
        context.sendJson(response, statusCodeResolve(message), {
            ok: false,
            error: message
        });
        return true;
    }

    return false;
}

function statusCodeResolve(message: string): number {
    const lower = message.toLowerCase();
    if (lower.includes("not found")) {
        return 404;
    }
    return 400;
}

function dataObjectRead(value: unknown): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}
