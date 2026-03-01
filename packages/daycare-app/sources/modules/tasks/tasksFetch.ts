import type { TaskActiveSummary } from "./tasksTypes";

/**
 * Fetches active tasks from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function tasksFetch(baseUrl: string, token: string): Promise<TaskActiveSummary[]> {
    const response = await fetch(`${baseUrl}/tasks/active`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; tasks?: TaskActiveSummary[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch tasks");
    }
    return data.tasks ?? [];
}
