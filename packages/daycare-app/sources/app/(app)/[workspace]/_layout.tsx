import { Slot } from "expo-router";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export default function WorkspaceLayout() {
    const { workspaceId, loaded } = useWorkspace();
    if (!loaded || !workspaceId) {
        return null;
    }
    return <Slot />;
}
