import { Redirect, useLocalSearchParams } from "expo-router";
import { type AppMode, appModes } from "@/components/AppHeader";
import { SidebarModeView } from "@/views/SidebarModeView";

export default function ModeScreen() {
    const { workspace, mode } = useLocalSearchParams<{ workspace: string; mode: string }>();

    if (!mode || !appModes.includes(mode as AppMode)) {
        return <Redirect href={`/${workspace ?? "~"}/home`} />;
    }

    return <SidebarModeView mode={mode as AppMode} />;
}
