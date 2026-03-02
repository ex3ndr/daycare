import type http from "node:http";
import type { Context, TaskActiveSummary, TaskListAllResult } from "@/types";
import type { RouteTaskCallbacks } from "../routeTypes.js";
import { tasksCreate } from "./tasksCreate.js";
import { tasksDelete } from "./tasksDelete.js";
import { tasksRead } from "./tasksRead.js";
import { tasksRun } from "./tasksRun.js";
import { tasksTriggerAdd } from "./tasksTriggerAdd.js";
import { tasksTriggerRemove } from "./tasksTriggerRemove.js";
import { tasksUpdate } from "./tasksUpdate.js";

export type TasksRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    tasksListActive: ((ctx: Context) => Promise<TaskActiveSummary[]>) | null;
    tasksListAll: ((ctx: Context) => Promise<TaskListAllResult>) | null;
    callbacks: RouteTaskCallbacks | null;
};

/**
 * Routes /tasks requests to authenticated task APIs.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: pathname starts with /tasks; context.ctx carries authenticated userId.
 */
export async function tasksRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: TasksRouteContext
): Promise<boolean> {
    if (pathname === "/tasks" && request.method === "GET") {
        if (!context.tasksListAll) {
            context.sendJson(response, 503, {
                ok: false,
                error: "Task runtime unavailable."
            });
            return true;
        }

        const result = await context.tasksListAll(context.ctx);
        context.sendJson(response, 200, { ok: true, ...result });
        return true;
    }

    if (pathname === "/tasks/active" && request.method === "GET") {
        if (!context.tasksListActive) {
            context.sendJson(response, 503, {
                ok: false,
                error: "Task runtime unavailable."
            });
            return true;
        }

        const tasks = await context.tasksListActive(context.ctx);
        context.sendJson(response, 200, { ok: true, tasks });
        return true;
    }

    if (pathname === "/tasks/create" && request.method === "POST") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const body = await context.readJsonBody(request);
        const result = await tasksCreate({
            ctx: context.ctx,
            body,
            tasksCreate: context.callbacks.tasksCreate
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const taskReadMatch = pathname.match(/^\/tasks\/([^/]+)$/);
    if (taskReadMatch?.[1] && request.method === "GET") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const result = await tasksRead({
            ctx: context.ctx,
            taskId: decodeURIComponent(taskReadMatch[1]),
            tasksRead: context.callbacks.tasksRead
        });
        context.sendJson(response, result.ok ? 200 : 404, result);
        return true;
    }

    const updateMatch = pathname.match(/^\/tasks\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const body = await context.readJsonBody(request);
        const result = await tasksUpdate({
            ctx: context.ctx,
            taskId: decodeURIComponent(updateMatch[1]),
            body,
            tasksUpdate: context.callbacks.tasksUpdate
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const deleteMatch = pathname.match(/^\/tasks\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && request.method === "POST") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const result = await tasksDelete({
            ctx: context.ctx,
            taskId: decodeURIComponent(deleteMatch[1]),
            tasksDelete: context.callbacks.tasksDelete
        });
        context.sendJson(response, result.ok ? 200 : 404, result);
        return true;
    }

    const runMatch = pathname.match(/^\/tasks\/([^/]+)\/run$/);
    if (runMatch?.[1] && request.method === "POST") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const body = await context.readJsonBody(request);
        const result = await tasksRun({
            ctx: context.ctx,
            taskId: decodeURIComponent(runMatch[1]),
            body,
            tasksRun: context.callbacks.tasksRun
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const triggerAddMatch = pathname.match(/^\/tasks\/([^/]+)\/triggers\/add$/);
    if (triggerAddMatch?.[1] && request.method === "POST") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const body = await context.readJsonBody(request);
        const result = await tasksTriggerAdd({
            ctx: context.ctx,
            taskId: decodeURIComponent(triggerAddMatch[1]),
            body,
            cronTriggerAdd: context.callbacks.cronTriggerAdd,
            webhookTriggerAdd: context.callbacks.webhookTriggerAdd
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const triggerRemoveMatch = pathname.match(/^\/tasks\/([^/]+)\/triggers\/remove$/);
    if (triggerRemoveMatch?.[1] && request.method === "POST") {
        if (!context.callbacks) {
            context.sendJson(response, 503, { ok: false, error: "Task runtime unavailable." });
            return true;
        }
        const body = await context.readJsonBody(request);
        const result = await tasksTriggerRemove({
            ctx: context.ctx,
            taskId: decodeURIComponent(triggerRemoveMatch[1]),
            body,
            cronTriggerRemove: context.callbacks.cronTriggerRemove,
            webhookTriggerRemove: context.callbacks.webhookTriggerRemove
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    return false;
}
