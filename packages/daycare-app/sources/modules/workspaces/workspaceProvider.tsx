import { usePathname } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { workspaceCurrentIdResolve, workspaceRouteIdResolve } from "./workspaceIdResolve";
import { useWorkspacesStore } from "./workspacesContext";
import type { WorkspaceListItem } from "./workspacesFetch";

type WorkspaceContextValue = {
    workspaceId: string;
    workspace: WorkspaceListItem;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

/**
 * Provides the current workspace derived from the route and available workspaces.
 * Expects: workspace layouts gate rendering until the workspace is resolved.
 */
export function WorkspaceProvider({ children }: PropsWithChildren): ReactNode {
    const pathname = usePathname();
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const loaded = useWorkspacesStore((state) => state.loaded);
    const routeWorkspaceId = React.useMemo(() => workspaceRouteIdResolve(pathname), [pathname]);

    const workspaceId = React.useMemo(
        () => workspaceCurrentIdResolve(routeWorkspaceId, workspaces, loaded),
        [loaded, routeWorkspaceId, workspaces]
    );
    const workspace = React.useMemo(
        () => workspaces.find((item) => item.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );
    const value = React.useMemo(
        () => (workspaceId && workspace ? { workspaceId, workspace } : null),
        [workspaceId, workspace]
    );

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Reads the current workspace from app context.
 * Expects: caller is rendered only after a workspace layout has resolved access.
 */
export function useWorkspace(): WorkspaceContextValue {
    const value = React.useContext(WorkspaceContext);
    if (!value) {
        throw new Error("Workspace context is unavailable.");
    }
    return value;
}
