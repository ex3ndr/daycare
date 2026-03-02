import type { TaskDetailResult } from "./tasksTypes";

/**
 * Fetches a single task with full details (code, parameters, triggers) from the app-server.
 * Expects: baseUrl and token are valid; taskId is non-empty.
 */
export async function taskDetailFetch(baseUrl: string, token: string, taskId: string): Promise<TaskDetailResult> {
    const response = await fetch(`${baseUrl}/tasks/${encodeURIComponent(taskId)}`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as {
        ok?: boolean;
        task?: TaskDetailResult["task"];
        triggers?: TaskDetailResult["triggers"];
        error?: string;
    };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch task");
    }
    if (!data.task) {
        throw new Error("Task not found");
    }
    return {
        task: data.task,
        triggers: data.triggers ?? { cron: [], webhook: [] }
    };
}
