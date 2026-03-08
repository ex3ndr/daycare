import { apiUrl } from "../api/apiUrl";

export type TodoTreeItem = {
    id: string;
    parentId: string | null;
    title: string;
    description: string;
    status: "draft" | "unstarted" | "started" | "finished" | "abandoned";
    rank: string;
    version: number;
    createdAt: number;
    updatedAt: number;
};

/**
 * Fetches the full todo tree as a flat preordered list.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function todosFetch(baseUrl: string, token: string, workspaceId: string | null): Promise<TodoTreeItem[]> {
    const url = apiUrl(baseUrl, "/todos/tree?depth=all", workspaceId);
    const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as {
        ok?: boolean;
        todos?: TodoTreeItem[];
        error?: string;
    };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch todos");
    }
    return data.todos ?? [];
}
