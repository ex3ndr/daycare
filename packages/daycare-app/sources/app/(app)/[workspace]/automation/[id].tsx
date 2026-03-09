import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { useAuthStore } from "@/modules/auth/authContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { AutomationDetailPanel } from "@/views/automations/AutomationDetailPanel";

export default function AutomationModalScreen() {
    const { theme } = useUnistyles();
    const { workspace, id } = useLocalSearchParams<{ workspace: string; id: string }>();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);

    const selectTask = useTasksStore((s) => s.selectTask);
    const detailLoading = useTasksStore((s) => s.detailLoading);
    const selectedDetail = useTasksStore((s) => s.selectedDetail);

    React.useEffect(() => {
        if (baseUrl && token && id) {
            selectTask(baseUrl, token, workspace, id);
        }
        return () => selectTask("", "", null, null);
    }, [baseUrl, token, workspace, id, selectTask]);

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            {detailLoading && !selectedDetail ? (
                <View style={styles.centered}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            ) : (
                <AutomationDetailPanel />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center"
    }
});
