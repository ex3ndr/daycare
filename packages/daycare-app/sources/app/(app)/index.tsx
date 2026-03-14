import { Redirect } from "expo-router";
import { routeDebugLog } from "@/modules/navigation/routeDebugLog";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

/**
 * App root index — redirects to the default workspace home.
 * Workspaces are guaranteed loaded by the (app) layout gate.
 */
export default function AppIndex() {
    const workspaces = useWorkspacesStore((state) => state.workspaces);
    const workspaceId = workspaces.find((workspace) => workspace.isSelf)?.userId ?? workspaces[0]?.userId ?? null;

    routeDebugLog("app-index", { workspaceId, workspaceCount: workspaces.length });

    if (!workspaceId) {
        return null;
    }
    return <Redirect href={`/${workspaceId}/home`} />;
}
