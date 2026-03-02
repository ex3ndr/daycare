import { Redirect, useLocalSearchParams } from "expo-router";
import { type AppMode, appModes } from "@/components/AppHeader";
import { AgentDetailView } from "@/views/agents/AgentDetailView";
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

    return <SidebarModeView mode={mode as AppMode} />;
}
