import { Redirect, Slot, usePathname } from "expo-router";
import * as React from "react";
import { useAuthStore } from "@/modules/auth/authContext";
import { workspaceRouteIdResolve } from "@/modules/workspaces/workspaceIdResolve";
import { WorkspaceProvider } from "@/modules/workspaces/workspaceProvider";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

export default function WorkspaceModalLayout() {
    const pathname = usePathname();
    const authState = useAuthStore((state) => state.state);
    const baseUrl = useAuthStore((state) => state.baseUrl);
    const token = useAuthStore((state) => state.token);
    const fetchWorkspaces = useWorkspacesStore((state) => state.fetch);
    const loaded = useWorkspacesStore((state) => state.loaded);
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const workspaceId = workspaceRouteIdResolve(pathname);
    const workspace = React.useMemo(
        () => workspaces.find((item) => item.userId === workspaceId) ?? null,
        [workspaceId, workspaces]
    );

    React.useEffect(() => {
        if (authState === "authenticated" && baseUrl && token) {
            void fetchWorkspaces(baseUrl, token);
        }
    }, [authState, baseUrl, token, fetchWorkspaces]);

    if (!loaded) {
        return null;
    }
    if (!workspaceId || !workspace) {
        return <Redirect href="/workspace-not-found" />;
    }
    return (
        <WorkspaceProvider workspaceId={workspace.userId} workspace={workspace}>
            <Slot />
        </WorkspaceProvider>
    );
}
