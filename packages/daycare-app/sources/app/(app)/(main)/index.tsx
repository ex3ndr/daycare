import { Redirect } from "expo-router";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

export default function AppIndex() {
    const loaded = useWorkspacesStore((state) => state.loaded);
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const workspaceId = workspaces.find((workspace) => workspace.isSelf)?.userId ?? workspaces[0]?.userId ?? null;

    if (!loaded) {
        return null;
    }
    return workspaceId ? <Redirect href={`/${workspaceId}/home`} /> : <Redirect href="/workspace-not-found" />;
}
