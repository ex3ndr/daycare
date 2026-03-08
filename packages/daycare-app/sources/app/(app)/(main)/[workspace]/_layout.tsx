import { Stack } from "expo-router";

const modalScreenOptions = {
    presentation: "modal" as const,
    animation: "fade_from_bottom" as const,
    webModalStyle: {
        width: "90vw",
        height: "90vh",
        minWidth: "min(1100px, 90vw)",
        minHeight: "min(800px, 90vh)"
    }
};

export default function WorkspaceLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="fragment/[id]" options={modalScreenOptions} />
            <Stack.Screen name="routine/[id]" options={modalScreenOptions} />
            <Stack.Screen name="todo/[id]" options={modalScreenOptions} />
            <Stack.Screen name="file-preview/[path]" options={modalScreenOptions} />
        </Stack>
    );
}
