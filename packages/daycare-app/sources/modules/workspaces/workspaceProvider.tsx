import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import type { WorkspaceListItem } from "./workspacesFetch";

type WorkspaceContextValue = {
    workspaceId: string;
    workspace: WorkspaceListItem;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(null);

type WorkspaceProviderProps = PropsWithChildren<WorkspaceContextValue>;

/**
 * Provides a validated current workspace to workspace-scoped routes.
 * Expects: layouts resolve access before rendering this provider.
 */
export function WorkspaceProvider({ children, workspaceId, workspace }: WorkspaceProviderProps): ReactNode {
    const value = React.useMemo(() => ({ workspaceId, workspace }), [workspaceId, workspace]);
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
