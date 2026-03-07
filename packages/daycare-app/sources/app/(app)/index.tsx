import { Redirect } from "expo-router";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

export default function AppIndex() {
    const activeId = useWorkspacesStore((s) => s.activeId);

    // Wait for workspaces to load before redirecting
    if (!activeId) return null;
    return <Redirect href={`/${activeId}/home`} />;
}
