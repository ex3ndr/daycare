import type { TaskListAllResult } from "./tasksTypes";

/**
 * Fetches all tasks and triggers from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function tasksFetch(baseUrl: string, token: string): Promise<TaskListAllResult> {
    const response = await fetch(`${baseUrl}/tasks`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as {
        ok?: boolean;
        tasks?: TaskListAllResult["tasks"];
        triggers?: TaskListAllResult["triggers"];
        error?: string;
    };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch tasks");
    }
    return {
        tasks: data.tasks ?? [],
        triggers: data.triggers ?? { cron: [], webhook: [] }
    };
}
