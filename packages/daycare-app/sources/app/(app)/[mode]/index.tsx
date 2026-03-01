import { Redirect, useLocalSearchParams } from "expo-router";
import { type AppMode, appModes } from "@/components/AppHeader";
import { ModeView } from "@/views/ModeView";

export default function ModeScreen() {
    const { mode } = useLocalSearchParams<{ mode: string }>();

    if (!mode || !appModes.includes(mode as AppMode)) {
        return <Redirect href="/agents" />;
    }

    return <ModeView mode={mode as AppMode} />;
}
