/**
 * Resolves the workspace scope for document API requests.
 * Expects: routeWorkspace comes from the current route and should win over stale store state.
 */
export function documentWorkspaceIdResolve(
    routeWorkspace: string | string[] | undefined,
    activeId: string | null
): string | null {
    if (typeof routeWorkspace === "string" && routeWorkspace.length > 0) {
        return routeWorkspace;
    }
    if (Array.isArray(routeWorkspace)) {
        const firstWorkspace = routeWorkspace.find((item) => item.length > 0);
        if (firstWorkspace) {
            return firstWorkspace;
        }
    }
    return activeId;
}
