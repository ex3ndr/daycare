import type { ObservationItem } from "./observationsTypes";

/**
 * Fetches recent observations from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function observationsFetch(baseUrl: string, token: string, limit = 100): Promise<ObservationItem[]> {
    const response = await fetch(`${baseUrl}/observations?limit=${limit}`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; observations?: ObservationItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch observations");
    }
    return data.observations ?? [];
}
