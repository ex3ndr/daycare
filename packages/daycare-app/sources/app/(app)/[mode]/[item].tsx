import { Redirect, useLocalSearchParams } from "expo-router";
import { type AppMode, appModes } from "@/components/AppHeader";
import { ModeView } from "@/views/ModeView";

export default function ModeItemScreen() {
    const { mode, item } = useLocalSearchParams<{ mode: string; item: string }>();

    if (!mode || !appModes.includes(mode as AppMode)) {
        return <Redirect href="/agents" />;
    }

    return <ModeView mode={mode as AppMode} selectedItem={item} />;
}
