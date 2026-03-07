import { router, usePathname } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { workspaceCurrentIdResolve, workspaceRouteIdResolve } from "./workspaceIdResolve";
import { useWorkspacesStore } from "./workspacesContext";
import type { WorkspaceListItem } from "./workspacesFetch";

type WorkspaceContextValue = {
    workspaceId: string | null;
    workspace: WorkspaceListItem | null;
    loaded: boolean;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue>({
    workspaceId: null,
    workspace: null,
    loaded: false
});

/**
 * Provides the current workspace derived from the route and available workspaces.
 * Expects: modal routes preserve workspace scope via the `workspace` query param.
 */
export function WorkspaceProvider({ children }: PropsWithChildren): ReactNode {
    const pathname = usePathname();
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const loaded = useWorkspacesStore((state) => state.loaded);
    const routeWorkspaceId = React.useMemo(() => workspaceRouteIdResolve(pathname), [pathname]);
    const hasRequestedWorkspaceAccess = React.useMemo(
        () => routeWorkspaceId === null || !loaded || workspaces.some((item) => item.userId === routeWorkspaceId),
        [loaded, routeWorkspaceId, workspaces]
    );

    const workspaceId = React.useMemo(
        () => workspaceCurrentIdResolve(routeWorkspaceId, workspaces, loaded),
        [loaded, routeWorkspaceId, workspaces]
    );
    const workspace = React.useMemo(
        () => workspaces.find((item) => item.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );
    const value = React.useMemo(() => ({ workspaceId, workspace, loaded }), [loaded, workspaceId, workspace]);

    React.useEffect(() => {
        if (
            !loaded ||
            routeWorkspaceId === null ||
            hasRequestedWorkspaceAccess ||
            pathname === "/workspace-not-found"
        ) {
            return;
        }
        router.replace("/workspace-not-found");
    }, [hasRequestedWorkspaceAccess, loaded, pathname, routeWorkspaceId]);

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Reads the current workspace from app context.
 * Expects: caller is rendered under `WorkspaceProvider`.
 */
export function useWorkspace(): WorkspaceContextValue {
    return React.useContext(WorkspaceContext);
}
