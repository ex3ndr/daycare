import { apiUrl } from "../api/apiUrl";
import type { SkillVersionsResult } from "./skillsTypes";

/**
 * Fetches archived versions for one skill from the app-server.
 * Expects: skillId belongs to a current user skill visible to the authenticated caller.
 */
export async function skillsVersionsFetch(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    skillId: string
): Promise<SkillVersionsResult> {
    const response = await fetch(apiUrl(baseUrl, `/skills/${encodeURIComponent(skillId)}/versions`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as ({ ok: true } & SkillVersionsResult) | { ok?: false; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch skill versions");
    }
    return {
        skillId: data.skillId,
        skillName: data.skillName,
        currentVersion: data.currentVersion,
        previousVersions: data.previousVersions
    };
}
