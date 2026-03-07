import { type AppMode, appModes } from "@/modules/navigation/appModes";
import type { WorkspaceListItem } from "./workspacesFetch";

/**
 * Resolves a workspace id from the current pathname.
 * Expects: workspace-scoped routes use `/:workspace/:mode`.
 */
export function workspaceRouteIdResolve(pathname: string): string | null {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && appModes.includes(parts[1] as AppMode)) {
        return parts[0] ?? null;
    }
    return null;
}

/**
 * Resolves the current workspace id for app requests.
 * Expects: route or query workspace should win; otherwise falls back to self or the first workspace.
 */
export function workspaceCurrentIdResolve(
    routeWorkspaceId: string | null,
    searchWorkspace: string | string[] | undefined,
    workspaces: WorkspaceListItem[]
): string | null {
    if (routeWorkspaceId) {
        return routeWorkspaceId;
    }

    if (typeof searchWorkspace === "string" && searchWorkspace.length > 0) {
        return searchWorkspace;
    }

    if (Array.isArray(searchWorkspace)) {
        const firstWorkspace = searchWorkspace.find((item) => item.length > 0);
        if (firstWorkspace) {
            return firstWorkspace;
        }
    }

    return workspaces.find((workspace) => workspace.isSelf)?.userId ?? workspaces[0]?.userId ?? null;
}
