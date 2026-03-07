import { useGlobalSearchParams, usePathname } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { workspaceCurrentIdResolve, workspaceRouteIdResolve } from "./workspaceIdResolve";
import { useWorkspacesStore } from "./workspacesContext";
import type { WorkspaceListItem } from "./workspacesFetch";

type WorkspaceContextValue = {
    workspaceId: string | null;
    workspace: WorkspaceListItem | null;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue>({
    workspaceId: null,
    workspace: null
});

/**
 * Provides the current workspace derived from the route and available workspaces.
 * Expects: modal routes preserve workspace scope via the `workspace` query param.
 */
export function WorkspaceProvider({ children }: PropsWithChildren): ReactNode {
    const pathname = usePathname();
    const { workspace: searchWorkspace } = useGlobalSearchParams<{ workspace?: string | string[] }>();
    const workspaces = useWorkspacesStore((state) => state.workspaces);

    const workspaceId = React.useMemo(
        () => workspaceCurrentIdResolve(workspaceRouteIdResolve(pathname), searchWorkspace, workspaces),
        [pathname, searchWorkspace, workspaces]
    );
    const workspace = React.useMemo(
        () => workspaces.find((item) => item.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );
    const value = React.useMemo(() => ({ workspaceId, workspace }), [workspaceId, workspace]);

    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Reads the current workspace from app context.
 * Expects: caller is rendered under `WorkspaceProvider`.
 */
export function useWorkspace(): WorkspaceContextValue {
    return React.useContext(WorkspaceContext);
}
