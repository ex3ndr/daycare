import { Redirect, Slot, usePathname } from "expo-router";
import { workspaceRouteIdResolve } from "@/modules/workspaces/workspaceIdResolve";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

export default function WorkspaceModalLayout() {
    const pathname = usePathname();
    const loaded = useWorkspacesStore((state) => state.loaded);
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const workspaceId = workspaceRouteIdResolve(pathname);

    if (!loaded) {
        return null;
    }
    if (!workspaceId || !workspaces.some((workspace) => workspace.userId === workspaceId)) {
        return <Redirect href="/workspace-not-found" />;
    }
    return <Slot />;
}
