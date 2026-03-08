import { useLocalSearchParams } from "expo-router";
import type { PropsWithChildren, ReactNode } from "react";
import * as React from "react";
import { WorkspaceProvider } from "@/modules/workspaces/workspaceProvider";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

/**
 * Resolves workspace from route params and provides WorkspaceProvider.
 * Used by modal routes that live outside the (main) layout.
 * Expects: route has a [workspace] param segment.
 */
export function WorkspaceModalWrapper({ children }: PropsWithChildren): ReactNode {
    const { workspace: workspaceId } = useLocalSearchParams<{ workspace: string }>();
    const workspaces = useWorkspacesStore((s) => s.workspaces);
    const workspace = React.useMemo(
        () => workspaces.find((w) => w.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );

    if (!workspace || !workspaceId) return null;

    return (
        <WorkspaceProvider workspaceId={workspaceId} workspace={workspace}>
            {children}
        </WorkspaceProvider>
    );
}
