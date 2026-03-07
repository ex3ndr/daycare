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
 * Resolves the requested workspace id from either the route or modal query param.
 * Expects: route workspace should win over query workspace when both are present.
 */
export function workspaceRequestedIdResolve(
    routeWorkspaceId: string | null,
    searchWorkspace: string | string[] | undefined
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

    return null;
}

/**
 * Resolves the current workspace id for app requests once access is known.
 * Expects: returns null until the workspace list is loaded and the requested workspace is validated.
 */
export function workspaceCurrentIdResolve(
    requestedWorkspaceId: string | null,
    workspaces: WorkspaceListItem[],
    loaded: boolean
): string | null {
    if (!loaded) {
        return null;
    }

    if (requestedWorkspaceId) {
        return workspaces.some((workspace) => workspace.userId === requestedWorkspaceId) ? requestedWorkspaceId : null;
    }

    return workspaces.find((workspace) => workspace.isSelf)?.userId ?? workspaces[0]?.userId ?? null;
}
