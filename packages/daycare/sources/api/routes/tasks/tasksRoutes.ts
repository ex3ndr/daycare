import type http from "node:http";
import type { Context, TaskActiveSummary } from "@/types";

export type TasksRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    tasksListActive: ((ctx: Context) => Promise<TaskActiveSummary[]>) | null;
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

    return false;
}
