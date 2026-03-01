import type { ProfileData } from "./profileTypes";

export type ProfileUpdateInput = {
    firstName?: string;
    lastName?: string;
    bio?: string;
    about?: string;
    country?: string;
    timezone?: string;
    systemPrompt?: string;
    memory?: boolean;
};

/**
 * Updates the authenticated user's profile fields.
 * Expects: baseUrl and token are valid; input contains at least one field.
 */
export async function profileUpdate(baseUrl: string, token: string, input: ProfileUpdateInput): Promise<ProfileData> {
    const response = await fetch(`${baseUrl}/profile/update`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; profile?: ProfileData; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to update profile");
    }
    if (!data.profile) {
        throw new Error("Profile data missing from response");
    }
    return data.profile;
}
