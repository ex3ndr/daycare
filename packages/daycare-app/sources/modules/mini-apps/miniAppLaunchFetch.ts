import { apiUrl } from "@/modules/api/apiUrl";
import type { MiniAppLaunch } from "./miniAppsTypes";

/**
 * Fetches a scoped launch path for one mini app.
 * Expects: workspaceId scopes the auth context; appId identifies an existing mini app.
 */
export async function miniAppLaunchFetch(
    baseUrl: string,
    token: string,
    workspaceId: string,
    appId: string
): Promise<MiniAppLaunch> {
    const response = await fetch(apiUrl(baseUrl, `/mini-apps/${encodeURIComponent(appId)}/launch`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error(`Failed to launch mini app: ${response.status}`);
    }
    const data = (await response.json()) as { ok?: boolean; launchPath?: string; expiresAt?: number };
    if (typeof data.launchPath !== "string" || typeof data.expiresAt !== "number") {
        throw new Error("Mini app launch response is invalid.");
    }
    return {
        launchPath: data.launchPath,
        expiresAt: data.expiresAt
    };
}
