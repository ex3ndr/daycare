import { Slot, useLocalSearchParams } from "expo-router";
import * as React from "react";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

/**
 * Workspace layout: reads the workspace param from the URL and sets it as active in the store.
 * Renders child routes via Slot.
 */
export default function WorkspaceLayout() {
    const { workspace } = useLocalSearchParams<{ workspace: string }>();
    const setActive = useWorkspacesStore((s) => s.setActive);

    React.useEffect(() => {
        if (workspace) {
            setActive(workspace);
        }
    }, [workspace, setActive]);

    return <Slot />;
}
