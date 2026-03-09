import { appModes } from "@/modules/navigation/appModes";
import type { WorkspaceListItem } from "./workspacesFetch";

const workspaceScopedRouteIds = new Set<string>([...appModes, "file-preview", "fragment", "automation"]);

/**
 * Resolves a workspace id from the current pathname.
 * Expects: workspace-scoped routes use `/:workspace/<workspace-scoped-route>`.
 */
export function workspaceRouteIdResolve(pathname: string): string | null {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && workspaceScopedRouteIds.has(parts[1] ?? "")) {
        return parts[0] ?? null;
    }
    return null;
}

/**
 * Resolves the current workspace id for app requests once access is known.
 * Expects: returns null until the workspace list is loaded and the requested workspace is validated.
 */
export function workspaceCurrentIdResolve(
    routeWorkspaceId: string | null,
    workspaces: WorkspaceListItem[],
    loaded: boolean
): string | null {
    if (!loaded) {
        return null;
    }

    if (routeWorkspaceId) {
        return workspaces.some((workspace) => workspace.userId === routeWorkspaceId) ? routeWorkspaceId : null;
    }

    return workspaces.find((workspace) => workspace.isSelf)?.userId ?? workspaces[0]?.userId ?? null;
}
