import { useLocalSearchParams } from "expo-router";
import * as React from "react";
import { ActivityIndicator, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/modules/auth/authContext";
import { useTasksStore } from "@/modules/tasks/tasksContext";
import { useWorkspacesStore } from "@/modules/workspaces/workspacesContext";
import { RoutineDetailPanel } from "@/views/routines/RoutineDetailPanel";

export default function RoutineDetailScreen() {
    const { theme } = useUnistyles();
    const { id } = useLocalSearchParams<{ id: string }>();

    const baseUrl = useAuthStore((s) => s.baseUrl);
    const token = useAuthStore((s) => s.token);
    const activeNametag = useWorkspacesStore((s) => s.activeNametag);
    const selectTask = useTasksStore((s) => s.selectTask);
    const detailLoading = useTasksStore((s) => s.detailLoading);
    const task = useTasksStore((s) => s.tasks.find((t) => t.id === id));

    // Select the task on mount, clear on unmount.
    React.useEffect(() => {
        if (baseUrl && token && id) {
            selectTask(baseUrl, token, activeNametag, id);
        }
        return () => {
            if (baseUrl && token) {
                selectTask(baseUrl, token, activeNametag, null);
            }
        };
    }, [baseUrl, token, activeNametag, id, selectTask]);

    return (
        <View style={[styles.root, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.inner}>
                <PageHeader title={task?.title ?? "Routine"} icon="clock" />
                {detailLoading ? (
                    <View style={[styles.centered, { flex: 1 }]}>
                        <ActivityIndicator color={theme.colors.primary} />
                    </View>
                ) : (
                    <RoutineDetailPanel />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create((theme) => ({
    root: {
        flex: 1,
        alignItems: "center"
    },
    inner: {
        flex: 1,
        width: "100%",
        maxWidth: theme.layout.maxWidth
    },
    centered: {
        alignItems: "center",
        justifyContent: "center"
    }
}));
