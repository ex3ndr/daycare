import { apiUrl } from "../api/apiUrl";

/**
 * Calls a server-side tool on behalf of a fragment via the tool bridge.
 * Expects: baseUrl/token are authenticated values, fragmentId/tool are non-empty strings.
 */
export async function fragmentCallTool(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    fragmentId: string,
    tool: string,
    args: Record<string, unknown> = {}
): Promise<unknown> {
    const response = await fetch(
        apiUrl(baseUrl, `/fragments/${encodeURIComponent(fragmentId)}/call`, workspaceId),
        {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ tool, args })
        }
    );
    const data = (await response.json()) as {
        ok?: boolean;
        result?: unknown;
        error?: string;
    };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Tool call failed");
    }
    return data.result;
}
