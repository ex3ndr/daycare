import { apiUrl } from "../api/apiUrl";

/**
 * Runs a read-only SQL query against a user-scoped structured database.
 * Expects: baseUrl/token are authenticated values and dbId/sql are non-empty strings.
 */
export async function databaseQuery(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    dbId: string,
    sql: string,
    params: unknown[] = []
): Promise<Record<string, unknown>[]> {
    const response = await fetch(apiUrl(baseUrl, `/databases/${encodeURIComponent(dbId)}/query`, workspaceNametag), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ sql, params })
    });
    const data = (await response.json()) as {
        ok?: boolean;
        rows?: Array<Record<string, unknown>>;
        error?: string;
    };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to query database");
    }
    return Array.isArray(data.rows) ? data.rows : [];
}
