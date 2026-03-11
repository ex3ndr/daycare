import { Redirect } from "expo-router";
import { Text, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useMiniAppsStore } from "@/modules/mini-apps/miniAppsContext";
import { MINI_APPS_EMPTY } from "@/modules/mini-apps/miniAppsStoreCreate";
import { useWorkspace } from "@/modules/workspaces/workspaceProvider";

export default function MiniAppsIndexRoute() {
    const { theme } = useUnistyles();
    const { workspaceId } = useWorkspace();
    const apps = useMiniAppsStore((state) => state.appsByWorkspace[workspaceId] ?? MINI_APPS_EMPTY);

    if (apps[0]) {
        return <Redirect href={`/${workspaceId}/mini-apps/${apps[0].id}`} />;
    }

    return (
        <View style={styles.center}>
            <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                No mini apps in this workspace.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24
    },
    message: {
        fontSize: 14,
        fontFamily: "IBMPlexSans-Regular",
        textAlign: "center"
    }
});
