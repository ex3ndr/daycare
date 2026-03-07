import { Redirect } from "expo-router";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";

export default function AppIndex() {
    const activeNametag = useWorkspacesStore((s) => s.activeNametag);

    // Use the active workspace nametag, or fallback to "~" (self)
    const workspace = activeNametag ?? "~";
    return <Redirect href={`/${workspace}/home`} />;
}
