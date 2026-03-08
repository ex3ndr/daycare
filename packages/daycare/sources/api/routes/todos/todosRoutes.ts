import type http from "node:http";
import type { Context } from "@/types";
import type { TodosRepository } from "../../../storage/todosRepository.js";
import { todosArchive } from "./todosArchive.js";
import { todosBatchStatus } from "./todosBatchStatus.js";
import { todosCreate } from "./todosCreate.js";
import { todosList } from "./todosList.js";
import { todosReorder } from "./todosReorder.js";
import { todosTree } from "./todosTree.js";
import { todosUpdate } from "./todosUpdate.js";

export type TodosRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    todos: TodosRepository | null;
};

/**
 * Routes authenticated todo APIs.
 * Returns true when a /todos request is matched.
 */
export async function todosRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: TodosRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/todos")) {
        return false;
    }

    if (!context.todos) {
        context.sendJson(response, 503, { ok: false, error: "Todos repository unavailable." });
        return true;
    }

    const query = new URL(request.url ?? "/", "http://daycare.local").searchParams;

    if (pathname === "/todos" && request.method === "GET") {
        const result = await todosList({ ctx: context.ctx, query, todos: context.todos });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/todos/tree" && request.method === "GET") {
        const result = await todosTree({ ctx: context.ctx, query, todos: context.todos });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/todos/create" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await todosCreate({ ctx: context.ctx, body, todos: context.todos });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/todos/batch-status" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await todosBatchStatus({ ctx: context.ctx, body, todos: context.todos });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    const updateMatch = pathname.match(/^\/todos\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await todosUpdate({
            ctx: context.ctx,
            id: decodeURIComponent(updateMatch[1]),
            body,
            todos: context.todos
        });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    const reorderMatch = pathname.match(/^\/todos\/([^/]+)\/reorder$/);
    if (reorderMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await todosReorder({
            ctx: context.ctx,
            id: decodeURIComponent(reorderMatch[1]),
            body,
            todos: context.todos
        });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    const archiveMatch = pathname.match(/^\/todos\/([^/]+)\/archive$/);
    if (archiveMatch?.[1] && request.method === "POST") {
        const result = await todosArchive({
            ctx: context.ctx,
            id: decodeURIComponent(archiveMatch[1]),
            todos: context.todos
        });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    return false;
}
