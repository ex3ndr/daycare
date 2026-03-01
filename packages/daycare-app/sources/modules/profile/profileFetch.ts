import type { ProfileData } from "./profileTypes";

/**
 * Fetches the authenticated user's profile from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function profileFetch(baseUrl: string, token: string): Promise<ProfileData> {
    const response = await fetch(`${baseUrl}/profile`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; profile?: ProfileData; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch profile");
    }
    if (!data.profile) {
        throw new Error("Profile data missing from response");
    }
    return data.profile;
}
