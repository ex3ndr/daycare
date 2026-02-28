import type { TokenStatsRow } from "./costsTypes";

/**
 * Fetches token stats rows from the app-server for a given time range.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function costsFetch(
    baseUrl: string,
    token: string,
    options: { from: number; to: number }
): Promise<TokenStatsRow[]> {
    const query = new URLSearchParams();
    query.set("from", String(options.from));
    query.set("to", String(options.to));
    const response = await fetch(`${baseUrl}/costs/token-stats?${query}`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; rows?: TokenStatsRow[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch costs");
    }
    return data.rows ?? [];
}
