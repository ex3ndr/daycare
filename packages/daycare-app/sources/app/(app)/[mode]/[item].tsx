import { Redirect, useLocalSearchParams } from "expo-router";
import { type AppMode, appModes } from "@/components/AppHeader";
import { filesPathDecode } from "@/modules/files/filesPathEncode";
import { AgentDetailView } from "@/views/agents/AgentDetailView";
import { FilesView } from "@/views/files/FilesView";
import { SidebarModeView } from "@/views/SidebarModeView";

export default function ModeItemScreen() {
    const { mode, item } = useLocalSearchParams<{ mode: string; item: string }>();

    if (!mode || !appModes.includes(mode as AppMode)) {
        return <Redirect href="/home" />;
    }

    // Agent detail: /agents/:agentId
    if (mode === "agents" && item) {
        return <AgentDetailView agentId={item} />;
    }

    // Files directory: /files/:encodedPath
    if (mode === "files" && item) {
        return <SidebarModeView mode="files" panel2Override={<FilesView dirPath={filesPathDecode(item)} />} />;
    }

    return <SidebarModeView mode={mode as AppMode} />;
}
