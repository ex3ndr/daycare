import { router, useGlobalSearchParams, usePathname } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { workspaceCurrentIdResolve, workspaceRequestedIdResolve, workspaceRouteIdResolve } from "./workspaceIdResolve";
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
    const { workspace: searchWorkspace } = useGlobalSearchParams<{ workspace?: string | string[] }>();
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const loaded = useWorkspacesStore((state) => state.loaded);
    const requestedWorkspaceId = React.useMemo(
        () => workspaceRequestedIdResolve(workspaceRouteIdResolve(pathname), searchWorkspace),
        [pathname, searchWorkspace]
    );
    const hasRequestedWorkspaceAccess = React.useMemo(
        () =>
            requestedWorkspaceId === null || !loaded || workspaces.some((item) => item.userId === requestedWorkspaceId),
        [loaded, requestedWorkspaceId, workspaces]
    );

    const workspaceId = React.useMemo(
        () => workspaceCurrentIdResolve(requestedWorkspaceId, workspaces, loaded),
        [loaded, requestedWorkspaceId, workspaces]
    );
    const workspace = React.useMemo(
        () => workspaces.find((item) => item.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );
    const value = React.useMemo(() => ({ workspaceId, workspace, loaded }), [loaded, workspaceId, workspace]);

    React.useEffect(() => {
        if (
            !loaded ||
            requestedWorkspaceId === null ||
            hasRequestedWorkspaceAccess ||
            pathname === "/workspace-not-found"
        ) {
            return;
        }
        router.replace("/workspace-not-found");
    }, [hasRequestedWorkspaceAccess, loaded, pathname, requestedWorkspaceId]);

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Reads the current workspace from app context.
 * Expects: caller is rendered under `WorkspaceProvider`.
 */
export function useWorkspace(): WorkspaceContextValue {
    return React.useContext(WorkspaceContext);
}
