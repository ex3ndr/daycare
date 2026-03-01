import type { SkillListItem } from "./skillsTypes";

/**
 * Fetches the list of available skills from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function skillsFetch(baseUrl: string, token: string): Promise<SkillListItem[]> {
    const response = await fetch(`${baseUrl}/skills`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; skills?: SkillListItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch skills");
    }
    return data.skills ?? [];
}
