import { Redirect } from "expo-router";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export default function AppIndex() {
    const { workspaceId } = useWorkspace();

    // Wait for workspaces to load before redirecting
    if (!workspaceId) return null;
    return <Redirect href={`/${workspaceId}/home`} />;
}
