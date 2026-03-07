import { Redirect } from "expo-router";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export default function AppIndex() {
    const { workspaceId, loaded } = useWorkspace();

    // Wait for workspaces to load before redirecting
    if (!loaded || !workspaceId) return null;
    return <Redirect href={`/${workspaceId}/home`} />;
}
